#include "tree_sitter/parser.h"

#include <assert.h>
#include <string.h>

enum TokenType {
	HEREDOC_START,
	HEREDOC_BODY,
	HEREDOC_END,
};

typedef struct {
	char delimiter[32];
	int delimiter_len;
	bool has_heredoc;
} Scanner;

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

static bool is_valid_heredoc_marker_char(int32_t c)
{
	return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
		   (c >= '0' && c <= '9') || c == '_';
}

static unsigned serialize(Scanner *scanner, char *buffer)
{
	if (scanner->has_heredoc) {
		buffer[0] = 1;
		memcpy(&buffer[1], scanner->delimiter, scanner->delimiter_len);
		return 1 + scanner->delimiter_len;
	} else {
		buffer[0] = 0;
		return 1;
	}
}

static void deserialize(Scanner *scanner, const char *buffer, unsigned length)
{
	if (length > 0) {
		scanner->has_heredoc = buffer[0] == 1;
		if (scanner->has_heredoc && length > 1) {
			scanner->delimiter_len = length - 1;
			memcpy(scanner->delimiter, &buffer[1], scanner->delimiter_len);
		} else {
			scanner->delimiter_len = 0;
		}
	}
}

static bool scan_heredoc_start(Scanner *scanner, TSLexer *lexer)
{
	// No spaces allowed at start of marker
	if (lexer->lookahead == ' ' || lexer->lookahead == '\t')
		return false;

	// Read the delimiter
	int delimiter_len = 0;
	char delimiter[32] = {0};

	// We should capture at least one character for the delimiter
	if (!is_valid_heredoc_marker_char(lexer->lookahead))
		return false;

	while (is_valid_heredoc_marker_char(lexer->lookahead) &&
		   delimiter_len < 31) {
		delimiter[delimiter_len++] = lexer->lookahead;
		advance(lexer);
	}

	// Must have a valid delimiter
	if (delimiter_len == 0)
		return false;

	// Store the delimiter for later matching
	memcpy(scanner->delimiter, delimiter, delimiter_len);
	scanner->delimiter_len = delimiter_len;
	scanner->has_heredoc = true;

	// Make sure we have a newline after the delimiter
	if (lexer->lookahead != '\n' && lexer->lookahead != '\r')
		return false;

	// Mark the end and set the result symbol
	lexer->mark_end(lexer);
	lexer->result_symbol = HEREDOC_START;
	return true;
}

static bool scan_heredoc_body(Scanner *scanner, TSLexer *lexer)
{
	if (!scanner->has_heredoc)
		return false;

	// Check if we're at the potential end delimiter
	bool is_start_of_line = lexer->get_column(lexer) == 0;
	if (is_start_of_line) {
		// Try to match the delimiter at the beginning of the line
		bool is_delimiter = true;
		int i;

		for (i = 0; i < scanner->delimiter_len; i++) {
			if (lexer->lookahead != scanner->delimiter[i]) {
				is_delimiter = false;
				break;
			}

			// Peek at the next character
			lexer->advance(lexer, false);
		}

		// Check if this is the end delimiter (must be followed by newline or
		// EOF)
		if (is_delimiter &&
			(lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
			 lexer->lookahead == 0)) {
			// This is the end delimiter - we should handle this in
			// scan_heredoc_end So we need to backtrack and return false
			for (int j = 0; j < i; j++) {
				// Since we can't reset, we have to mark this as invalid
				// and let the scanner try again for heredoc_end
				lexer->mark_end(lexer);
			}
			return false;
		}

		// If we advanced but it's not an end delimiter, we need to include
		// those characters in our heredoc_body
		if (i > 0) {
			lexer->mark_end(lexer);
			lexer->result_symbol = HEREDOC_BODY;
			return true;
		}
	}

	// Consume characters until newline or EOF
	bool found_content = false;
	while (lexer->lookahead != 0) {
		found_content = true;
		advance(lexer);

		if (lexer->lookahead == '\n') {
			advance(lexer);
			break;
		}
	}

	if (!found_content && lexer->lookahead == 0)
		return false;

	lexer->mark_end(lexer);
	lexer->result_symbol = HEREDOC_BODY;
	return true;
}

static bool scan_heredoc_end(Scanner *scanner, TSLexer *lexer)
{
	if (!scanner->has_heredoc)
		return false;

	// Must be at the start of a line
	if (lexer->get_column(lexer) != 0)
		return false;

	// Check if this line matches the delimiter exactly
	for (int i = 0; i < scanner->delimiter_len; i++) {
		if (lexer->lookahead != scanner->delimiter[i])
			return false;
		advance(lexer);
	}

	// Should be end of line or file after delimiter
	if (lexer->lookahead != '\n' && lexer->lookahead != 0 &&
		lexer->lookahead != '\r')
		return false;

	// Mark the end before advancing past newline
	lexer->mark_end(lexer);

	if (lexer->lookahead == '\n' || lexer->lookahead == '\r') {
		advance(lexer);
	}

	scanner->has_heredoc = false;
	lexer->result_symbol = HEREDOC_END;
	return true;
}

static bool scan(Scanner *scanner, TSLexer *lexer, const bool *valid_symbols)
{
	// Check for heredoc end first
	if (valid_symbols[HEREDOC_END] && scan_heredoc_end(scanner, lexer)) {
		return true;
	}

	// Then check for heredoc body
	if (valid_symbols[HEREDOC_BODY] && scan_heredoc_body(scanner, lexer)) {
		return true;
	}

	// Finally check for heredoc start
	if (valid_symbols[HEREDOC_START] && scan_heredoc_start(scanner, lexer)) {
		return true;
	}

	return false;
}

void *tree_sitter_caddyfile_external_scanner_create()
{
	Scanner *scanner = calloc(1, sizeof(Scanner));
	return scanner;
}

void tree_sitter_caddyfile_external_scanner_destroy(void *payload)
{
	Scanner *scanner = (Scanner *)payload;
	free(scanner);
}

bool tree_sitter_caddyfile_external_scanner_scan(void *payload, TSLexer *lexer,
												 const bool *valid_symbols)
{
	Scanner *scanner = (Scanner *)payload;
	return scan(scanner, lexer, valid_symbols);
}

unsigned tree_sitter_caddyfile_external_scanner_serialize(void *payload,
														  char *buffer)
{
	Scanner *scanner = (Scanner *)payload;
	return serialize(scanner, buffer);
}

void tree_sitter_caddyfile_external_scanner_deserialize(void *payload,
														const char *buffer,
														unsigned length)
{
	Scanner *scanner = (Scanner *)payload;
	deserialize(scanner, buffer, length);
}
