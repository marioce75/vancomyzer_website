// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "Vancomyzer",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v13),
        .macOS(.v14),
        .watchOS(.v10),
        .tvOS(.v17)
    ],
    products: [
        // Main app target
        .library(
            name: "VancomyzerCore",
            targets: ["VancomyzerCore"]
        ),
        // Calculation engine
        .library(
            name: "VancomycinCalculator",
            targets: ["VancomycinCalculator"]
        ),
        // Bayesian engine
        .library(
            name: "BayesianEngine",
            targets: ["BayesianEngine"]
        ),
        // UI components
        .library(
            name: "VancomyzerUI",
            targets: ["VancomyzerUI"]
        )
    ],
    dependencies: [
        // SwiftUI and Combine are built-in, no external dependencies needed for core functionality
        // Optional: Analytics (only if user opts in)
        .package(
            url: "https://github.com/firebase/firebase-ios-sdk.git",
            from: "10.0.0"
        ),
        
        // Optional: Crash reporting
        .package(
            url: "https://github.com/getsentry/sentry-cocoa.git",
            from: "8.0.0"
        ),
        
        // Testing utilities
        .package(
            url: "https://github.com/pointfreeco/swift-snapshot-testing.git",
            from: "1.12.0"
        ),
        
        // Accelerate framework for mathematical computations
        // (Built-in iOS framework, no package needed)
        
        // Localization utilities
        .package(
            url: "https://github.com/SwiftGen/SwiftGenPlugin.git",
            from: "6.6.0"
        )
    ],
    targets: [
        // MARK: - Core Targets
        
        .target(
            name: "VancomyzerCore",
            dependencies: [
                "VancomycinCalculator",
                "BayesianEngine",
                "VancomyzerUI"
            ],
            path: "Sources/VancomyzerCore",
            resources: [
                .process("Resources/Localizations"),
                .process("Resources/Assets"),
                .process("Resources/Guidelines")
            ],
            swiftSettings: [
                .enableUpcomingFeature("BareSlashRegexLiterals"),
                .enableUpcomingFeature("ConciseMagicFile"),
                .enableUpcomingFeature("ExistentialAny"),
                .enableUpcomingFeature("ForwardTrailingClosures"),
                .enableUpcomingFeature("ImplicitOpenExistentials"),
                .enableUpcomingFeature("StrictConcurrency"),
                .define("VANCOMYZER_CORE")
            ]
        ),
        
        .target(
            name: "VancomycinCalculator",
            dependencies: [],
            path: "Sources/VancomycinCalculator",
            resources: [
                .process("Resources/PopulationModels"),
                .process("Resources/ClinicalGuidelines")
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .define("VANCOMYCIN_CALCULATOR"),
                .define("ASHP_IDSA_2020_COMPLIANT")
            ]
        ),
        
        .target(
            name: "BayesianEngine",
            dependencies: [],
            path: "Sources/BayesianEngine",
            resources: [
                .process("Resources/PopulationPriors"),
                .process("Resources/CovarianceMatrices")
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .define("BAYESIAN_ENGINE"),
                .define("MAP_ESTIMATION_ENABLED")
            ],
            linkerSettings: [
                .linkedFramework("Accelerate")
            ]
        ),
        
        .target(
            name: "VancomyzerUI",
            dependencies: [],
            path: "Sources/VancomyzerUI",
            resources: [
                .process("Resources/Themes"),
                .process("Resources/Icons"),
                .process("Resources/Animations")
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .define("VANCOMYZER_UI"),
                .define("ACCESSIBILITY_ENABLED")
            ]
        ),
        
        // MARK: - Optional Analytics Targets
        
        .target(
            name: "VancomyzerAnalytics",
            dependencies: [
                .product(name: "FirebaseAnalytics", package: "firebase-ios-sdk", condition: .when(configuration: .release)),
                .product(name: "FirebaseCrashlytics", package: "firebase-ios-sdk", condition: .when(configuration: .release))
            ],
            path: "Sources/VancomyzerAnalytics",
            swiftSettings: [
                .define("ANALYTICS_ENABLED", .when(configuration: .release)),
                .define("PRIVACY_FIRST_ANALYTICS")
            ]
        ),
        
        .target(
            name: "VancomyzerCrashReporting",
            dependencies: [
                .product(name: "Sentry", package: "sentry-cocoa", condition: .when(configuration: .release))
            ],
            path: "Sources/VancomyzerCrashReporting",
            swiftSettings: [
                .define("CRASH_REPORTING_ENABLED", .when(configuration: .release)),
                .define("PHI_PROTECTION_ENABLED")
            ]
        ),
        
        // MARK: - Test Targets
        
        .testTarget(
            name: "VancomyzerCoreTests",
            dependencies: [
                "VancomyzerCore",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ],
            path: "Tests/VancomyzerCoreTests",
            resources: [
                .process("Resources/TestData"),
                .process("Resources/ReferenceImages")
            ],
            swiftSettings: [
                .define("TESTING_ENABLED"),
                .define("SNAPSHOT_TESTING_ENABLED")
            ]
        ),
        
        .testTarget(
            name: "VancomycinCalculatorTests",
            dependencies: [
                "VancomycinCalculator"
            ],
            path: "Tests/VancomycinCalculatorTests",
            resources: [
                .process("Resources/ClinicalTestCases"),
                .process("Resources/ValidationData")
            ],
            swiftSettings: [
                .define("CALCULATOR_TESTING"),
                .define("CLINICAL_VALIDATION_ENABLED")
            ]
        ),
        
        .testTarget(
            name: "BayesianEngineTests",
            dependencies: [
                "BayesianEngine"
            ],
            path: "Tests/BayesianEngineTests",
            resources: [
                .process("Resources/BayesianTestData"),
                .process("Resources/ReferenceResults")
            ],
            swiftSettings: [
                .define("BAYESIAN_TESTING"),
                .define("MAP_VALIDATION_ENABLED")
            ]
        ),
        
        .testTarget(
            name: "VancomyzerUITests",
            dependencies: [
                "VancomyzerUI",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ],
            path: "Tests/VancomyzerUITests",
            resources: [
                .process("Resources/UITestData"),
                .process("Resources/AccessibilityTests")
            ],
            swiftSettings: [
                .define("UI_TESTING"),
                .define("ACCESSIBILITY_TESTING_ENABLED")
            ]
        ),
        
        // MARK: - Performance Test Targets
        
        .testTarget(
            name: "VancomyzerPerformanceTests",
            dependencies: [
                "VancomyzerCore",
                "VancomycinCalculator",
                "BayesianEngine"
            ],
            path: "Tests/VancomyzerPerformanceTests",
            swiftSettings: [
                .define("PERFORMANCE_TESTING"),
                .define("BENCHMARK_ENABLED")
            ]
        ),
        
        // MARK: - Integration Test Targets
        
        .testTarget(
            name: "VancomyzerIntegrationTests",
            dependencies: [
                "VancomyzerCore"
            ],
            path: "Tests/VancomyzerIntegrationTests",
            resources: [
                .process("Resources/IntegrationTestData")
            ],
            swiftSettings: [
                .define("INTEGRATION_TESTING"),
                .define("END_TO_END_TESTING")
            ]
        ),
        
        // MARK: - Accessibility Test Targets
        
        .testTarget(
            name: "VancomyzerAccessibilityTests",
            dependencies: [
                "VancomyzerUI"
            ],
            path: "Tests/VancomyzerAccessibilityTests",
            swiftSettings: [
                .define("ACCESSIBILITY_TESTING"),
                .define("VOICEOVER_TESTING_ENABLED")
            ]
        ),
        
        // MARK: - Localization Test Targets
        
        .testTarget(
            name: "VancomyzerLocalizationTests",
            dependencies: [
                "VancomyzerCore"
            ],
            path: "Tests/VancomyzerLocalizationTests",
            resources: [
                .process("Resources/LocalizationTestData")
            ],
            swiftSettings: [
                .define("LOCALIZATION_TESTING"),
                .define("RTL_TESTING_ENABLED")
            ]
        )
    ],
    swiftLanguageVersions: [.v5]
)

// MARK: - Conditional Dependencies

#if os(iOS)
package.dependencies.append(
    .package(
        url: "https://github.com/apple/swift-algorithms.git",
        from: "1.0.0"
    )
)
#endif

// MARK: - Development Dependencies

#if DEBUG
package.dependencies.append(contentsOf: [
    .package(
        url: "https://github.com/pointfreeco/swift-custom-dump.git",
        from: "1.0.0"
    ),
    .package(
        url: "https://github.com/pointfreeco/swift-identified-collections.git",
        from: "1.0.0"
    )
])
#endif

// MARK: - Platform-Specific Configurations

#if os(macOS)
// macOS-specific dependencies for development tools
package.dependencies.append(
    .package(
        url: "https://github.com/apple/swift-format.git",
        from: "508.0.0"
    )
)
#endif

// MARK: - Compiler Flags

let commonSwiftSettings: [SwiftSetting] = [
    .enableUpcomingFeature("BareSlashRegexLiterals"),
    .enableUpcomingFeature("ConciseMagicFile"),
    .enableUpcomingFeature("ExistentialAny"),
    .enableUpcomingFeature("ForwardTrailingClosures"),
    .enableUpcomingFeature("ImplicitOpenExistentials"),
    .enableUpcomingFeature("StrictConcurrency"),
    .define("SWIFT_PACKAGE_MANAGER"),
    .define("VANCOMYZER_VERSION_1_0_0")
]

// Apply common settings to all targets
for target in package.targets {
    if target.swiftSettings == nil {
        target.swiftSettings = []
    }
    target.swiftSettings?.append(contentsOf: commonSwiftSettings)
}

// MARK: - Build Configuration

#if DEBUG
// Debug-specific settings
for target in package.targets {
    target.swiftSettings?.append(contentsOf: [
        .define("DEBUG"),
        .define("TESTING_ENABLED"),
        .define("VERBOSE_LOGGING")
    ])
}
#else
// Release-specific settings
for target in package.targets {
    target.swiftSettings?.append(contentsOf: [
        .define("RELEASE"),
        .define("OPTIMIZED_BUILD"),
        .define("ANALYTICS_ENABLED")
    ])
}
#endif

// MARK: - Medical Device Compliance

// Add medical device compliance flags
for target in package.targets {
    target.swiftSettings?.append(contentsOf: [
        .define("MEDICAL_DEVICE_SOFTWARE"),
        .define("FDA_CLASS_I_COMPLIANT"),
        .define("ASHP_IDSA_2020_GUIDELINES"),
        .define("CLINICAL_DECISION_SUPPORT"),
        .define("EVIDENCE_BASED_MEDICINE")
    ])
}

// MARK: - Privacy and Security

// Add privacy and security flags
for target in package.targets {
    target.swiftSettings?.append(contentsOf: [
        .define("PRIVACY_BY_DESIGN"),
        .define("NO_PHI_COLLECTION"),
        .define("ON_DEVICE_PROCESSING"),
        .define("HIPAA_COMPLIANT"),
        .define("GDPR_COMPLIANT")
    ])
}

// MARK: - Quality Assurance

// Add quality assurance flags
for target in package.targets {
    target.swiftSettings?.append(contentsOf: [
        .define("HIGH_TEST_COVERAGE"),
        .define("CLINICAL_VALIDATION"),
        .define("PERFORMANCE_OPTIMIZED"),
        .define("ACCESSIBILITY_COMPLIANT"),
        .define("INTERNATIONALIZATION_READY")
    ])
}
