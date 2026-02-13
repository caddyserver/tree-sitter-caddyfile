/**
 * @file Caddyfile grammar for tree-sitter
 * @author Matthew Penner <me@matthewp.io>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const NEW_LINE_REGEX = /\r?\n|\r/;

const IPV4_REGEX = /((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)/;

const IPV6_REGEX =
	/(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))/;

const ipv4Cidr = token(seq(IPV4_REGEX, token.immediate('/'), token.immediate(/[0-9]|1[0-9]|2[0-9]|3[0-2]/)));
const ipv6Cidr = token(seq(IPV6_REGEX, token.immediate('/'), token.immediate(/[0-9][0-9]?|1[01][0-9]|12[0-8]/)));

const URL_SCHEME_REGEX = /[a-z]+:\/\//;

const PORT_REGEX = /[0-9]{1,5}/;

// NOTE: do not use `[a-z]{2,}` here. tree-sitter doesn't handle that regex
// syntax correctly. The grammar will compile but it won't match correctly.
const tld = choice(/[a-z][a-z]+/, /xn--[a-z0-9]+/);

// Must start with `a-z`, after the first character `0-9` and `-` are allowed,
// cannot end with a `-`.
const DOMAIN_SECTION_REGEX = /[a-z][a-z0-9\-]*[a-z0-9]+/;

// Hostname regex, allows:
// - Domains (example.com)
// - Subdomains (sub.example.com)
// - Punycode (example.xn--ses554g)
//
// This regex does not match wildcards (*.com), or bare domains (localhost).
//
// The exclusion of bare domains from this regex is intentional to avoid
// matching arguments as hostnames, as there is no way to determine if
// something is a bare hostname or an argument without having knowledge
// of every single directive and the argument types it supports.
//
// If you want something like `localhost` or `my-hostname` to match, add a
// scheme so it can get matched as a network address.
const hostname = seq(DOMAIN_SECTION_REGEX, repeat(seq('.', DOMAIN_SECTION_REGEX)), '.', tld);

const bareHostname = seq(DOMAIN_SECTION_REGEX, repeat(seq('.', DOMAIN_SECTION_REGEX)), optional(seq('.', tld)));

const environmentVariable = token(
	seq(
		'{$',
		// TODO: is `token.immediate` necessary here?
		token.immediate(/[a-zA-Z0-9][a-zA-Z0-9_.\[\]]*/),
		optional(seq(':', /[^}\n\r]+/)),
		'}',
	),
);

const subdirectiveFields = $ => [
	repeat(
		choice(
			$.network_address,
			$.environment_variable,
			$.placeholder,
			$._string_literal,
			$.duration_literal,
			$.int_literal,
			$.status_code_fallback,
			$.argument,
			$.heredoc,
		),
	),
	choice($.block, token.immediate(NEW_LINE_REGEX)),
];

const directiveFields = $ => [optional($.matcher), ...subdirectiveFields($)];

const IPV6_ADDRESS = seq('[', IPV6_REGEX, optional(seq('%', /[a-z0-9]+/)), ']');

module.exports = grammar({
	name: 'caddyfile',

	extras: $ => [$.comment, /\s/],

	externals: $ => [$.heredoc_start, $.heredoc_body, $.heredoc_end],

	rules: {
		//
		// Caddyfile
		//

		source_file: $ =>
			seq(
				// Allow a single "global options" block at the beginning of the file.
				optional($.global_options),

				// Allow multiple snippet definitions and/or named routes.
				repeat(choice($.snippet_definition, $.named_route)),

				// Allow site definitions, either a single site or multiple site blocks.
				optional($.sites),
			),

		// Global options is a special block that only allows the use of directives.
		// Defining snippets or named matchers is not allowed in it's scope.
		//
		// https://caddyserver.com/docs/caddyfile/concepts#snippets
		global_options: $ => seq('{', token.immediate(NEW_LINE_REGEX), repeat($.directive), '}'),

		// Snippets are re-usable parts of a caddyfile, the content of a snippet can be anything
		// that is allowed inside of a site block.
		//
		// Snippets must be defined outside of a site block and after global options (if present).
		snippet_name: _ => token(seq('(', /[a-zA-Z0-9\-_]+/, ')')),
		snippet_definition: $ => seq(field('name', $.snippet_name), $.block),

		// Experimental; named routes use a syntax similar to snippets.
		//
		// Named routes are a special block, defined outside of site blocks.
		//
		// https://caddyserver.com/docs/caddyfile/concepts#named-routes
		named_route_identifier: _ => token(seq('&(', /[a-zA-Z0-9\-_]+/, ')')),
		named_route: $ => seq(field('name', $.named_route_identifier), $.block),

		//
		// Addresses
		//

		_ipv4_address: _ => IPV4_REGEX,
		_ipv6_address: _ => IPV6_REGEX,
		_ip_address: _ => choice(IPV4_REGEX, IPV6_REGEX),

		_ipv4_cidr: _ => ipv4Cidr,
		_ipv6_cidr: _ => ipv6Cidr,
		_ip_cidr: _ => choice(ipv4Cidr, ipv6Cidr),

		ip_address_or_cidr: _ => choice(IPV4_REGEX, IPV6_REGEX, ipv4Cidr, ipv6Cidr),

		network_address: _ =>
			choice(
				token(
					seq(
						choice(IPV4_REGEX, IPV6_ADDRESS, hostname),
						optional(seq(':', PORT_REGEX)),
						repeat(seq('/', /([A-Za-z0-9\-_.~!&'\(\)*+,;=:#]|%[0-9a-fA-F]{2})*/)),
					),
				),
				token(
					seq(
						choice('http', 'https', 'h2c'),
						'://',
						choice(IPV4_REGEX, IPV6_ADDRESS, bareHostname),
						optional(seq(':', PORT_REGEX)),
						repeat(seq('/', /([A-Za-z0-9\-_.~!&'\(\)*+,;=:#]|%[0-9a-fA-F]{2})*/)),
					),
				),

				token(seq(field('network', choice('fd', 'fdgram')), '/', field('address', /[0-9]+/))),

				token(
					seq(
						field('network', choice('unix', 'unix+h2c', 'unixgram', 'unixpacket')),
						'/',
						field('address', /\/[a-zA-Z0-9_\-./*]+/),
						optional(seq('|', field('perms', /[0-9]{3,4}/))),
					),
				),

				token(
					seq(
						field('network', choice('ip', 'ip4', 'ip6', 'tcp', 'tcp4', 'tcp6', 'udp', 'udp4', 'udp6')),
						'/',
						field('address', seq(choice(IPV4_REGEX, IPV6_ADDRESS, bareHostname), optional(seq(':', PORT_REGEX)))),
					),
				),

				token(field('address', seq(bareHostname, ':', PORT_REGEX))),
			),

		site_address: $ =>
			choice(
				// Bare protocols
				'http://',
				'https://',
				// TODO: is `h2c://` also supported here?

				// Bare port
				token(seq(':', PORT_REGEX)),

				// `:{$ENV_VAR}`
				seq(optional(':'), $._environment_variable),

				// Environment variable.
				//
				// According to the Caddy docs, placeholders cannot be used in addresses,
				// but you can use environment variables. `{$ENV_VAR}`, not `{env.ENV_VAR}`
				$._environment_variable,

				token(
					seq(
						// TODO: I understand allowing http and https but why all schemes?
						optional(URL_SCHEME_REGEX),
						choice(
							IPV4_REGEX,
							IPV6_ADDRESS,
							// Hostname regex, allows:
							// - Bare domains (localhost, my-system, etc),
							// - Domains (example.com)
							// - Subdomains (sub.example.com)
							// - Punycode (example.xn--ses554g)
							//
							// Also allows for a wildcard (*) as the furthest left subdomain.
							seq(choice('*', DOMAIN_SECTION_REGEX), repeat(seq('.', DOMAIN_SECTION_REGEX)), optional(seq('.', tld))),
						),
						optional(seq(':', PORT_REGEX)),
					),
				),
			),

		//
		// Tokens
		//

		// Comment is available at the start (or during) a line that contains a # with preceding whitespace
		comment: _ => token(seq('#', /.*/)),

		// Argument is pretty much anything that isn't a matcher
		argument: _ =>
			choice(
				// Normal arguments without @ or starting with non-@ characters
				/[a-zA-Z\-_+.\\\/*]([a-zA-Z\-_+.\\\/*0-9@]*)/,

				// Arguments starting with @ that contain more @ characters
				// (like @longhorn-ui@/share/share/lib/longhorn-ui)
				/@[a-zA-Z\-_+.\\\/*]*@[a-zA-Z\-_+.\\\/*]*/,
			),

		// Fallback status code, primarily used with `try_files` as the last argument.
		status_code_fallback: _ => token(seq('=', /[0-9]{3}/)),

		// Placeholder is used for environment variables or runtime value substitution
		placeholder: $ => $._placeholder,
		_placeholder: _ =>
			token(
				seq(
					'{',
					// TODO: this is probably not the best way to write this.
					//
					// You cannot nest placeholders in each other, but you can nest
					// environment variables. Environment variables are replaced separately
					// of placeholders when the Caddyfile is parsed which is how this works.
					//
					// The issue with this grammar is that the environment variable can only
					// be at the end of the placeholder, but the Caddyfile parser allows
					// there to be any number of environment variables inside of a
					// placeholder.
					token.immediate(/[a-zA-Z0-9][a-zA-Z0-9_.\[\]]*/),
					optional(environmentVariable),
					'}',
				),
			),
		environment_variable: $ => $._environment_variable,
		_environment_variable: _ => environmentVariable,

		// Directives
		directive_name: _ => /[a-zA-Z_\-+]+/,
		directive: $ => seq(field('name', $.directive_name), ...directiveFields($)),

		// https://caddyserver.com/docs/caddyfile/matchers#path-matchers
		path: _ => token(prec(2, seq(choice('/', '\\'), /([a-zA-Z0-9\-_%\\\/.]+)*(\*)?/))),

		// https://caddyserver.com/docs/caddyfile/matchers#named-matchers
		matcher_name: _ => /[a-zA-Z0-9\-_]+/,
		matcher_identifier: $ => seq('@', field('name', $.matcher_name)),
		// matcher_identifier: _ => token(prec(1, seq('@', field('name', /[a-zA-Z0-9\-_]+/)))),

		// https://caddyserver.com/docs/caddyfile/matchers#expression
		_bare_cel_expression: $ => repeat1($._bare_cel_expression_content),
		_bare_cel_expression_content: _ => token.immediate(prec(1, /[^\n]+/)),
		_quoted_cel_expression: $ => prec(2, repeat1($._quoted_cel_expression_content)),
		_quoted_cel_expression_content: _ => token.immediate(prec(1, /[^`\n]+/)),

		// These are used so we can recognize matchers as built-ins.
		matcher_block: $ => seq('{', token.immediate(NEW_LINE_REGEX), field('body', repeat($.matcher_directive)), '}'),
		matcher_directive_name: _ => seq(optional('not'), /[a-zA-Z_+]+/),
		matcher_directive: $ =>
			seq(
				choice(
					seq('`', field('expression', alias($._quoted_cel_expression, $.cel_expression)), token.immediate('`')),
					seq(
						'expression',
						choice(
							// Due the regex for `_bare_cel_expression` matching everything except a new-line,
							// we need *lexical precedence* (which requires `token(prec(<number>, ...))`) in
							// order to match the quoted expression if a ` is present.
							seq(token(prec(2, '`')), field('expression', alias($._quoted_cel_expression, $.cel_expression)), token.immediate('`')),
							field('expression', alias($._bare_cel_expression, $.cel_expression)),
						),
					),
					seq(
						field('name', $.matcher_directive_name),
						choice(
							$.matcher_block,
							repeat1(
								choice(
									$.network_address,
									$.environment_variable,
									$.placeholder,
									$.path,
									$._string_literal,
									$.duration_literal,
									$.int_literal,
									$.argument,
									$.heredoc,
									$.ip_address_or_cidr,
								),
							),
						),
					),
				),
				token.immediate(NEW_LINE_REGEX),
			),

		// named_matcher is for the actual definition, like `@name host example.com`
		// or with a body.
		named_matcher: $ => seq($.matcher_identifier, choice($.matcher_block, $.matcher_directive)),

		matcher: $ =>
			choice(
				// Allow a lone `*`
				'*',
				// Path matching
				alias($.path, $.path_matcher),
				// Named matcher
				$.matcher_identifier,
			),

		//
		// Sites
		//

		_definition: $ => choice($.directive, $.named_matcher),

		// Block is a site block that is allowed to define directives and named matchers.
		block: $ => seq('{', token.immediate(NEW_LINE_REGEX), field('body', repeat($._definition)), '}'),

		site_definition: $ => seq(field('name', commaSep1($.site_address)), $.block),

		sites: $ => choice($.single_site, repeat1($.site_definition)),

		single_site: $ => seq(field('name', commaSep1($.site_address)), field('body', repeat($._definition))),

		//
		// Literals
		//

		_string_literal: $ => choice($.raw_string_literal, $.interpreted_string_literal),

		raw_string_literal: $ => seq('`', repeat($._raw_string_literal_basic_content), token.immediate('`')),
		_raw_string_literal_basic_content: _ => token.immediate(prec(1, /[^`\n]+/)),

		interpreted_string_literal: $ => seq('"', repeat(choice($._interpreted_string_literal_basic_content, $.escape_sequence)), token.immediate('"')),
		_interpreted_string_literal_basic_content: _ => token.immediate(prec(1, /[^"\n\\]+/)),

		escape_sequence: _ => token.immediate(seq('\\', choice(/[^xuU]/, /\d{2,3}/, /x[0-9a-fA-F]{2,}/, /u[0-9a-fA-F]{4}/, /U[0-9a-fA-F]{8}/))),

		int_literal: _ => token(choice('0', seq(/[1-9]/, repeat(/[0-9]/)))),
		duration_literal: _ => token(seq(choice('0', seq(/[1-9]/, repeat(/[0-9]/))), /(ns|us|µs|ms|s|m|h|d)/)),

		//
		// Heredocs (implementation is in `src/scanner.c`)
		//

		// TODO: what happens if there is a leading `\` (heredoc escape)?
		heredoc: $ => seq('<<', field('identifier', $.heredoc_start), optional(field('value', repeat($.heredoc_body))), field('end_tag', $.heredoc_end)),
	},
});

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
	return seq(rule, repeat(seq(token.immediate(/, /), rule)));
}
