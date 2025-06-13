(comment) @comment
(placeholder) @constant

[
  (network_address)
  (ip_address_or_cidr)
] @type

[
  (snippet_name)
  (named_route_identifier)
  (site_address)
] @keyword

(directive (directive_name) @property)

; directive for a named matcher declaration
(matcher_directive (matcher_directive_name)) @function.builtin

; named matcher declaration
(named_matcher (matcher_identifier (matcher_name)) @function.method)

; named matcher call
(matcher (matcher_identifier (matcher_name)) @function.macro)

; any other matcher (wildcard and path)
(matcher) @function.macro

[
  (interpreted_string_literal)
  (raw_string_literal)
  (heredoc)
  (cel_expression)
] @string
(escape_sequence) @escape

[
  (duration_literal)
  (int_literal)
] @number

[
  "{"
  "}"
] @punctuation.bracket
