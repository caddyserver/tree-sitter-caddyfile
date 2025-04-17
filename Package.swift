// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "TreeSitterCaddyfile",
    products: [
        .library(name: "TreeSitterCaddyfile", targets: ["TreeSitterCaddyfile"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ChimeHQ/SwiftTreeSitter", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterCaddyfile",
            dependencies: [],
            path: ".",
            sources: [
                "src/parser.c",
                "src/scanner.c",
            ],
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterCaddyfileTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterCaddyfile",
            ],
            path: "bindings/swift/TreeSitterCaddyfileTests"
        )
    ],
    cLanguageStandard: .c11
)
