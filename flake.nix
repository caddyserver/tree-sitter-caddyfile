{
  description = "Tree Sitter Grammar for Caddyfiles";

  inputs = {
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };

    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";

    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = inputs:
    inputs.flake-parts.lib.mkFlake {inherit inputs;} {
      systems = import inputs.systems;

      imports = [
        inputs.treefmt-nix.flakeModule
      ];

      perSystem = {
        pkgs,
        system,
        ...
      }: {
        _module.args.pkgs = import inputs.nixpkgs {inherit system;};

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            cargo
            emscripten
            gcc
            go
            nodejs
            nodePackages.node-gyp
            python3
            rustc
            tree-sitter
          ];
        };

        treefmt = {
          projectRootFile = "flake.nix";

          settings.global.excludes = [
            ".editorconfig"
            "LICENSE"
            "**/node_modules"
            "**/package-lock.json"
          ];

          programs = {
            # Enable actionlint, a GitHub Actions static checker.
            actionlint.enable = true;

            # Enable alejandra, a Nix formatter.
            alejandra.enable = true;

            # Enable clang-format, a formatter for C code.
            clang-format.enable = true;

            # Enable deadnix, a Nix linter/formatter that removes un-used Nix code.
            deadnix.enable = true;

            # Enable prettier, a generic formatter usually used for JavaScript.
            prettier = {
              enable = true;
              includes = [
                "*.js"
                "*.mjs"
                "*.json"
                "*.md"
                "*.ts"
              ];
            };

            # Enable yamlfmt, a YAML formatter.
            yamlfmt = {
              enable = true;
              settings.formatter = {
                type = "basic";
                retain_line_breaks_single = true;
              };
            };
          };
        };
      };
    };
}
