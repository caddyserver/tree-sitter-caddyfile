# tree-sitter-caddyfile

Caddyfile grammar for tree-sitter

## Reporting Problems

If you find any problems with the grammar, open an [issue](https://github.com/caddyserver/tree-sitter-caddyfile/issues/new)
first. Please include any files or screenshots relating to the problem so it
can be reproduced and resolved.

Please limit issues to a single problem with the grammar, open multiple separate
issues if necessary. This makes them easier to fix and track, plus easier to
track (and possibly revert) any regressions.

## Pull Requests

In most cases, opening a pull requests is unnecessary. The Caddyfile syntax is
quite complex and careful consideration needs to be taken when modifying the
grammar to avoid complex parsing issues and unnecessary complexity.

Very few pull requests are merged as-is and many changes are manually applied
and recommitted. It is preferred to just create issues and let us fix the
grammar.

If you wish to create a pull request, you may do so, but please associate it
with an issue. Pull requests fixing the grammar should only have a single
commit and must be limited to fixing a single issue with the grammar.

Pull requests fixing the grammar should always add tests to ensure regressions
don't occur and making it easy to see in the diff what the grammar change
actually fixed.

Pull requests not associated with an issue or without tests (that aren't solely
fixing existing failing tests) will be closed and ignored.
