import Foundation
import os.log
import UIKit

// MARK: - Analytics Manager

@MainActor
class AnalyticsManager: ObservableObject {
    static let shared = AnalyticsManager()
    
    @Published var isAnalyticsEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isAnalyticsEnabled, forKey: "analytics_enabled")
            if !isAnalyticsEnabled {
                clearAllAnalyticsData()
            }
        }
    }
    
    @Published var isCrashReportingEnabled: Bool {
        didSet {
            UserDefaults.standard.set(isCrashReportingEnabled, forKey: "crash_reporting_enabled")
        }
    }
    
    private let logger = Logger(subsystem: "com.vancomyzer.analytics", category: "Analytics")
    private var sessionId: String
    private var sessionStartTime: Date
    
    private init() {
        self.isAnalyticsEnabled = UserDefaults.standard.bool(forKey: "analytics_enabled")
        self.isCrashReportingEnabled = UserDefaults.standard.bool(forKey: "crash_reporting_enabled")
        self.sessionId = UUID().uuidString
        self.sessionStartTime = Date()
        
        setupCrashReporting()
        startSession()
    }
    
    // MARK: - Session Management
    
    private func startSession() {
        guard isAnalyticsEnabled else { return }
        
        let event = AnalyticsEvent(
            name: "session_start",
            parameters: [
                "session_id": sessionId,
                "app_version": Bundle.main.appVersion,
                "build_number": Bundle.main.buildNumber,
                "device_model": UIDevice.current.model,
                "ios_version": UIDevice.current.systemVersion,
                "locale": Locale.current.identifier
            ]
        )
        
        trackEvent(event)
        logger.info("Analytics session started: \(self.sessionId)")
    }
    
    func endSession() {
        guard isAnalyticsEnabled else { return }
        
        let sessionDuration = Date().timeIntervalSince(sessionStartTime)
        let event = AnalyticsEvent(
            name: "session_end",
            parameters: [
                "session_id": sessionId,
                "session_duration": sessionDuration
            ]
        )
        
        trackEvent(event)
        logger.info("Analytics session ended: \(self.sessionId), duration: \(sessionDuration)s")
    }
    
    // MARK: - Event Tracking
    
    func trackCalculation(
        populationType: PopulationType,
        indication: Indication,
        severity: Severity,
        usedBayesian: Bool,
        calculationTime: TimeInterval
    ) {
        guard isAnalyticsEnabled else { return }
        
        let event = AnalyticsEvent(
            name: "calculation_performed",
            parameters: [
                "population_type": populationType.rawValue,
                "indication": indication.rawValue,
                "severity": severity.rawValue,
                "used_bayesian": usedBayesian,
                "calculation_time_ms": calculationTime * 1000,
                "session_id": sessionId
            ]
        )
        
        trackEvent(event)
    }
    
    func trackBayesianOptimization(
        numberOfLevels: Int,
        optimizationTime: TimeInterval,
        convergenceAchieved: Bool
    ) {
        guard isAnalyticsEnabled else { return }
        
        let event = AnalyticsEvent(
            name: "bayesian_optimization",
            parameters: [
                "number_of_levels": numberOfLevels,
                "optimization_time_ms": optimizationTime * 1000,
                "convergence_achieved": convergenceAchieved,
                "session_id": sessionId
            ]
        )
        
        trackEvent(event)
    }
    
    func trackFeatureUsage(_ feature: String, parameters: [String: Any] = [:]) {
        guard isAnalyticsEnabled else { return }
        
        var eventParameters = parameters
        eventParameters["session_id"] = sessionId
        eventParameters["timestamp"] = Date().timeIntervalSince1970
        
        let event = AnalyticsEvent(
            name: "feature_used",
            parameters: eventParameters.merging(["feature_name": feature]) { _, new in new }
        )
        
        trackEvent(event)
    }
    
    func trackUserPreference(setting: String, value: Any) {
        guard isAnalyticsEnabled else { return }
        
        let event = AnalyticsEvent(
            name: "preference_changed",
            parameters: [
                "setting": setting,
                "value": String(describing: value),
                "session_id": sessionId
            ]
        )
        
        trackEvent(event)
    }
    
    func trackError(_ error: Error, context: String) {
        guard isCrashReportingEnabled else { return }
        
        let event = AnalyticsEvent(
            name: "error_occurred",
            parameters: [
                "error_description": error.localizedDescription,
                "error_domain": (error as NSError).domain,
                "error_code": (error as NSError).code,
                "context": context,
                "session_id": sessionId
            ]
        )
        
        trackEvent(event)
        logger.error("Error tracked: \(error.localizedDescription) in context: \(context)")
    }
    
    // MARK: - Privacy and Data Management
    
    func exportUserData() -> [String: Any] {
        guard isAnalyticsEnabled else { return [:] }
        
        return [
            "analytics_enabled": isAnalyticsEnabled,
            "crash_reporting_enabled": isCrashReportingEnabled,
            "session_id": sessionId,
            "data_collection_notice": "Vancomyzer collects anonymized usage data to improve the app. No patient health information is collected or transmitted."
        ]
    }
    
    func clearAllAnalyticsData() {
        // Clear any locally stored analytics data
        UserDefaults.standard.removeObject(forKey: "analytics_session_data")
        logger.info("All analytics data cleared")
    }
    
    func requestDataDeletion() {
        clearAllAnalyticsData()
        isAnalyticsEnabled = false
        isCrashReportingEnabled = false
        logger.info("User requested data deletion")
    }
    
    // MARK: - Private Methods
    
    private func trackEvent(_ event: AnalyticsEvent) {
        // In a real implementation, this would send to your analytics service
        // For privacy compliance, ensure no PHI is included
        
        logger.info("Analytics event: \(event.name) with parameters: \(event.parameters)")
        
        // Store locally for potential batch upload (optional)
        storeEventLocally(event)
    }
    
    private func storeEventLocally(_ event: AnalyticsEvent) {
        // Store events locally for batch processing
        // Implement with appropriate data retention policies
        let eventData = try? JSONSerialization.data(withJSONObject: event.toDictionary())
        // Store in secure local storage if needed
    }
    
    private func setupCrashReporting() {
        guard isCrashReportingEnabled else { return }
        
        // Setup crash reporting (integrate with Crashlytics, Sentry, etc.)
        NSSetUncaughtExceptionHandler { exception in
            AnalyticsManager.shared.handleCrash(exception: exception)
        }
        
        logger.info("Crash reporting initialized")
    }
    
    private func handleCrash(exception: NSException) {
        guard isCrashReportingEnabled else { return }
        
        let crashEvent = AnalyticsEvent(
            name: "app_crash",
            parameters: [
                "exception_name": exception.name.rawValue,
                "exception_reason": exception.reason ?? "Unknown",
                "session_id": sessionId,
                "app_version": Bundle.main.appVersion,
                "build_number": Bundle.main.buildNumber
            ]
        )
        
        trackEvent(crashEvent)
        logger.fault("App crash detected: \(exception.name.rawValue) - \(exception.reason ?? "Unknown")")
    }
}

// MARK: - Analytics Event Model

struct AnalyticsEvent {
    let name: String
    let parameters: [String: Any]
    let timestamp: Date
    
    init(name: String, parameters: [String: Any]) {
        self.name = name
        self.parameters = parameters
        self.timestamp = Date()
    }
    
    func toDictionary() -> [String: Any] {
        return [
            "name": name,
            "parameters": parameters,
            "timestamp": timestamp.timeIntervalSince1970
        ]
    }
}

// MARK: - Feature Flag Manager

@MainActor
class FeatureFlagManager: ObservableObject {
    static let shared = FeatureFlagManager()
    
    @Published var flags: [String: Bool] = [:]
    
    private let logger = Logger(subsystem: "com.vancomyzer.features", category: "FeatureFlags")
    
    private init() {
        loadDefaultFlags()
        loadRemoteFlags()
    }
    
    private func loadDefaultFlags() {
        flags = [
            "advanced_bayesian_mode": false,
            "experimental_calculations": false,
            "enhanced_ui_animations": true,
            "detailed_pk_plots": false,
            "export_to_emr": false,
            "multi_patient_mode": false,
            "clinical_decision_support": true,
            "real_time_monitoring": false
        ]
    }
    
    private func loadRemoteFlags() {
        // In a real implementation, fetch from remote config service
        // For now, use local defaults with ability to override
        
        if let overrides = UserDefaults.standard.dictionary(forKey: "feature_flag_overrides") {
            for (key, value) in overrides {
                if let boolValue = value as? Bool {
                    flags[key] = boolValue
                }
            }
        }
        
        logger.info("Feature flags loaded: \(self.flags)")
    }
    
    func isEnabled(_ flag: String) -> Bool {
        return flags[flag] ?? false
    }
    
    func setFlag(_ flag: String, enabled: Bool) {
        flags[flag] = enabled
        
        // Store override locally
        var overrides = UserDefaults.standard.dictionary(forKey: "feature_flag_overrides") ?? [:]
        overrides[flag] = enabled
        UserDefaults.standard.set(overrides, forKey: "feature_flag_overrides")
        
        // Track flag change
        AnalyticsManager.shared.trackFeatureUsage("feature_flag_changed", parameters: [
            "flag_name": flag,
            "enabled": enabled
        ])
        
        logger.info("Feature flag changed: \(flag) = \(enabled)")
    }
    
    func refreshFlags() {
        // Refresh from remote service
        loadRemoteFlags()
    }
}

// MARK: - Performance Monitor

class PerformanceMonitor {
    static let shared = PerformanceMonitor()
    
    private let logger = Logger(subsystem: "com.vancomyzer.performance", category: "Performance")
    private var measurements: [String: [TimeInterval]] = [:]
    
    private init() {}
    
    func startMeasurement(_ operation: String) -> PerformanceMeasurement {
        return PerformanceMeasurement(operation: operation, monitor: self)
    }
    
    func recordMeasurement(_ operation: String, duration: TimeInterval) {
        if measurements[operation] == nil {
            measurements[operation] = []
        }
        measurements[operation]?.append(duration)
        
        // Keep only last 100 measurements per operation
        if measurements[operation]!.count > 100 {
            measurements[operation]?.removeFirst()
        }
        
        logger.info("Performance: \(operation) took \(duration * 1000)ms")
        
        // Track slow operations
        if duration > 1.0 { // More than 1 second
            AnalyticsManager.shared.trackFeatureUsage("slow_operation", parameters: [
                "operation": operation,
                "duration_ms": duration * 1000
            ])
        }
    }
    
    func getAverageTime(for operation: String) -> TimeInterval? {
        guard let times = measurements[operation], !times.isEmpty else { return nil }
        return times.reduce(0, +) / Double(times.count)
    }
    
    func getPerformanceReport() -> [String: Any] {
        var report: [String: Any] = [:]
        
        for (operation, times) in measurements {
            guard !times.isEmpty else { continue }
            
            let average = times.reduce(0, +) / Double(times.count)
            let min = times.min() ?? 0
            let max = times.max() ?? 0
            
            report[operation] = [
                "average_ms": average * 1000,
                "min_ms": min * 1000,
                "max_ms": max * 1000,
                "sample_count": times.count
            ]
        }
        
        return report
    }
}

// MARK: - Performance Measurement

class PerformanceMeasurement {
    private let operation: String
    private let startTime: CFAbsoluteTime
    private let monitor: PerformanceMonitor
    
    init(operation: String, monitor: PerformanceMonitor) {
        self.operation = operation
        self.monitor = monitor
        self.startTime = CFAbsoluteTimeGetCurrent()
    }
    
    func end() {
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        monitor.recordMeasurement(operation, duration: duration)
    }
}

// MARK: - Bundle Extensions

extension Bundle {
    var appVersion: String {
        return infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }
    
    var buildNumber: String {
        return infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }
}

// MARK: - Usage Examples

/*
// Track a calculation
let measurement = PerformanceMonitor.shared.startMeasurement("vancomycin_calculation")
// ... perform calculation ...
measurement.end()

AnalyticsManager.shared.trackCalculation(
    populationType: .adult,
    indication: .pneumonia,
    severity: .moderate,
    usedBayesian: false,
    calculationTime: 0.15
)

// Track feature usage
AnalyticsManager.shared.trackFeatureUsage("settings_opened")

// Check feature flag
if FeatureFlagManager.shared.isEnabled("advanced_bayesian_mode") {
    // Show advanced features
}

// Track error
do {
    try someRiskyOperation()
} catch {
    AnalyticsManager.shared.trackError(error, context: "patient_input_validation")
}
*/

