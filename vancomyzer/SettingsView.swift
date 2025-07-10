import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var userPreferences: UserPreferences
    @Environment(\.presentationMode) var presentationMode
    @State private var showingPrivacyPolicy = false
    @State private var showingEULA = false
    @State private var showingAbout = false
    @State private var showingExportData = false
    @State private var showingDeleteConfirmation = false
    
    var body: some View {
        NavigationView {
            List {
                // User Preferences Section
                Section(header: Text("Preferences")) {
                    // Language selection
                    HStack {
                        Image(systemName: "globe")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Language")
                        
                        Spacer()
                        
                        Picker("Language", selection: $userPreferences.selectedLanguage) {
                            Text("English").tag("en")
                            Text("Español").tag("es")
                            Text("العربية").tag("ar")
                        }
                        .pickerStyle(MenuPickerStyle())
                    }
                    
                    // Theme selection
                    HStack {
                        Image(systemName: "paintbrush")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Appearance")
                        
                        Spacer()
                        
                        Picker("Theme", selection: $userPreferences.colorScheme) {
                            Text("System").tag(ColorScheme?.none)
                            Text("Light").tag(ColorScheme?.some(.light))
                            Text("Dark").tag(ColorScheme?.some(.dark))
                        }
                        .pickerStyle(MenuPickerStyle())
                    }
                    
                    // Units
                    HStack {
                        Image(systemName: "ruler")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Units")
                        
                        Spacer()
                        
                        Picker("Units", selection: $userPreferences.unitSystem) {
                            Text("Metric").tag(UnitSystem.metric)
                            Text("Imperial").tag(UnitSystem.imperial)
                        }
                        .pickerStyle(MenuPickerStyle())
                    }
                }
                
                // Clinical Preferences Section
                Section(header: Text("Clinical Preferences")) {
                    // Default population
                    HStack {
                        Image(systemName: "person.3")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Default Population")
                        
                        Spacer()
                        
                        Picker("Population", selection: $userPreferences.defaultPopulation) {
                            ForEach(PopulationType.allCases) { population in
                                Text(population.localizedName).tag(population)
                            }
                        }
                        .pickerStyle(MenuPickerStyle())
                    }
                    
                    // Default CrCl method
                    HStack {
                        Image(systemName: "drop")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Default CrCl Method")
                        
                        Spacer()
                        
                        Picker("CrCl Method", selection: $userPreferences.defaultCrClMethod) {
                            ForEach(CrClMethod.allCases) { method in
                                Text(method.localizedName).tag(method)
                            }
                        }
                        .pickerStyle(MenuPickerStyle())
                    }
                    
                    // Show warnings
                    Toggle(isOn: $userPreferences.showClinicalWarnings) {
                        HStack {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Show Clinical Warnings")
                        }
                    }
                    
                    // Auto-save calculations
                    Toggle(isOn: $userPreferences.autoSaveCalculations) {
                        HStack {
                            Image(systemName: "square.and.arrow.down")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Auto-save Calculations")
                        }
                    }
                }
                
                // Privacy & Analytics Section
                Section(header: Text("Privacy & Analytics")) {
                    // Analytics consent
                    Toggle(isOn: $userPreferences.analyticsEnabled) {
                        HStack {
                            Image(systemName: "chart.bar")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Usage Analytics")
                                Text("Help improve Vancomyzer with anonymous usage data")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    // Crash reporting
                    Toggle(isOn: $userPreferences.crashReportingEnabled) {
                        HStack {
                            Image(systemName: "exclamationmark.octagon")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Crash Reporting")
                                Text("Send anonymous crash reports to help fix issues")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    // Data export
                    Button(action: { showingExportData = true }) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Export My Data")
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                    
                    // Delete all data
                    Button(action: { showingDeleteConfirmation = true }) {
                        HStack {
                            Image(systemName: "trash")
                                .foregroundColor(.red)
                                .frame(width: 24)
                            
                            Text("Delete All Data")
                                .foregroundColor(.red)
                            
                            Spacer()
                        }
                    }
                }
                
                // Accessibility Section
                Section(header: Text("Accessibility")) {
                    // VoiceOver enhancements
                    Toggle(isOn: $userPreferences.enhancedVoiceOver) {
                        HStack {
                            Image(systemName: "speaker.wave.2")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Enhanced VoiceOver")
                                Text("Detailed descriptions for screen readers")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    
                    // High contrast
                    Toggle(isOn: $userPreferences.highContrastMode) {
                        HStack {
                            Image(systemName: "circle.lefthalf.filled")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("High Contrast Mode")
                        }
                    }
                    
                    // Reduce motion
                    Toggle(isOn: $userPreferences.reduceMotion) {
                        HStack {
                            Image(systemName: "motion.sensor")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Reduce Motion")
                        }
                    }
                    
                    // Large text
                    HStack {
                        Image(systemName: "textformat.size")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Text Size")
                        
                        Spacer()
                        
                        Picker("Text Size", selection: $userPreferences.textSize) {
                            Text("Small").tag(TextSize.small)
                            Text("Medium").tag(TextSize.medium)
                            Text("Large").tag(TextSize.large)
                            Text("Extra Large").tag(TextSize.extraLarge)
                        }
                        .pickerStyle(MenuPickerStyle())
                    }
                }
                
                // Support Section
                Section(header: Text("Support")) {
                    // Help & Tutorial
                    Button(action: { showingAbout = true }) {
                        HStack {
                            Image(systemName: "questionmark.circle")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Help & Tutorial")
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                    
                    // Contact support
                    Button(action: contactSupport) {
                        HStack {
                            Image(systemName: "envelope")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Contact Support")
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            Image(systemName: "arrow.up.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                    
                    // Rate app
                    Button(action: rateApp) {
                        HStack {
                            Image(systemName: "star")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Rate Vancomyzer")
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            Image(systemName: "arrow.up.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                    
                    // Share app
                    Button(action: shareApp) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Share Vancomyzer")
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            Image(systemName: "arrow.up.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                }
                
                // Legal Section
                Section(header: Text("Legal")) {
                    // Privacy Policy
                    Button(action: { showingPrivacyPolicy = true }) {
                        HStack {
                            Image(systemName: "hand.raised")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Privacy Policy")
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                    
                    // Terms of Use
                    Button(action: { showingEULA = true }) {
                        HStack {
                            Image(systemName: "doc.text")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Terms of Use")
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                    
                    // Licenses
                    Button(action: showLicenses) {
                        HStack {
                            Image(systemName: "doc.badge.gearshape")
                                .foregroundColor(.vancoBlue)
                                .frame(width: 24)
                            
                            Text("Open Source Licenses")
                                .foregroundColor(.primary)
                            
                            Spacer()
                            
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                                .font(.caption)
                        }
                    }
                }
                
                // App Information Section
                Section(header: Text("App Information")) {
                    HStack {
                        Image(systemName: "info.circle")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Version")
                        
                        Spacer()
                        
                        Text(Bundle.main.appVersion)
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Image(systemName: "hammer")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Build")
                        
                        Spacer()
                        
                        Text(Bundle.main.buildNumber)
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Image(systemName: "calendar")
                            .foregroundColor(.vancoBlue)
                            .frame(width: 24)
                        
                        Text("Last Updated")
                        
                        Spacer()
                        
                        Text("December 2024")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .navigationBarItems(
                trailing: Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
        .sheet(isPresented: $showingPrivacyPolicy) {
            PrivacyPolicyView()
        }
        .sheet(isPresented: $showingEULA) {
            EULAView()
        }
        .sheet(isPresented: $showingAbout) {
            AboutView()
        }
        .sheet(isPresented: $showingExportData) {
            DataExportView()
        }
        .alert("Delete All Data", isPresented: $showingDeleteConfirmation) {
            Button("Cancel", role: .cancel) { }
            Button("Delete", role: .destructive) {
                deleteAllData()
            }
        } message: {
            Text("This will permanently delete all your calculation history and preferences. This action cannot be undone.")
        }
    }
    
    private func contactSupport() {
        if let url = URL(string: "mailto:support@vancomyzer.com?subject=Vancomyzer Support") {
            UIApplication.shared.open(url)
        }
    }
    
    private func rateApp() {
        if let url = URL(string: "https://apps.apple.com/app/vancomyzer/id123456789?action=write-review") {
            UIApplication.shared.open(url)
        }
    }
    
    private func shareApp() {
        let activityVC = UIActivityViewController(
            activityItems: [
                "Check out Vancomyzer - Evidence-based vancomycin dosing for healthcare professionals",
                URL(string: "https://apps.apple.com/app/vancomyzer/id123456789")!
            ],
            applicationActivities: nil
        )
        
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first {
            window.rootViewController?.present(activityVC, animated: true)
        }
    }
    
    private func showLicenses() {
        // Implementation for showing open source licenses
    }
    
    private func deleteAllData() {
        // Clear all user data
        CalculationHistoryManager.shared.clearAllHistory()
        userPreferences.resetToDefaults()
        
        // Track analytics
        AnalyticsManager.shared.track(.dataDeleted)
    }
}

// MARK: - Privacy Policy View

struct PrivacyPolicyView: View {
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Privacy Policy")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .padding(.bottom)
                    
                    PrivacySection(
                        title: "Data Collection",
                        content: """
                        Vancomyzer is designed with privacy-by-design principles. We collect minimal data necessary for app functionality:
                        
                        • App usage analytics (if enabled)
                        • Crash reports (if enabled)
                        • User preferences and settings
                        
                        We do NOT collect:
                        • Patient health information (PHI)
                        • Personal identifying information
                        • Calculation results or patient data
                        """
                    )
                    
                    PrivacySection(
                        title: "Data Storage",
                        content: """
                        All patient data and calculations are stored locally on your device only. No patient information is transmitted to our servers or third parties.
                        
                        • Calculations remain on your device
                        • No cloud synchronization of patient data
                        • Data is encrypted using iOS security features
                        """
                    )
                    
                    PrivacySection(
                        title: "Analytics",
                        content: """
                        If you opt-in to analytics, we collect anonymous usage data to improve the app:
                        
                        • Feature usage statistics
                        • App performance metrics
                        • Crash reports (no personal data)
                        
                        You can disable analytics at any time in Settings.
                        """
                    )
                    
                    PrivacySection(
                        title: "Third-Party Services",
                        content: """
                        Vancomyzer may use third-party services for analytics and crash reporting. These services are configured to respect your privacy choices and comply with healthcare privacy standards.
                        """
                    )
                    
                    PrivacySection(
                        title: "Your Rights",
                        content: """
                        You have the right to:
                        
                        • Export your data
                        • Delete all data
                        • Opt-out of analytics
                        • Request information about data processing
                        
                        Contact us at privacy@vancomyzer.com for any privacy-related questions.
                        """
                    )
                    
                    Text("Last updated: December 2024")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top)
                }
                .padding()
            }
            .navigationTitle("Privacy Policy")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                trailing: Button("Done") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
}

struct PrivacySection: View {
    let title: String
    let content: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
                .fontWeight(.semibold)
            
            Text(content)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Data Export View

struct DataExportView: View {
    @Environment(\.presentationMode) var presentationMode
    @State private var isExporting = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Image(systemName: "square.and.arrow.up.circle")
                    .font(.system(size: 60))
                    .foregroundColor(.vancoBlue)
                
                Text("Export Your Data")
                    .font(.title)
                    .fontWeight(.bold)
                
                Text("Export your calculation history and preferences as a JSON file. This file contains no patient health information.")
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                
                VStack(spacing: 12) {
                    Button(action: exportData) {
                        HStack {
                            if isExporting {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .scaleEffect(0.8)
                            }
                            
                            Text(isExporting ? "Exporting..." : "Export Data")
                                .fontWeight(.semibold)
                        }
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.vancoBlue)
                        .cornerRadius(12)
                    }
                    .disabled(isExporting)
                    
                    Text("The exported file will be saved to your Files app")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            .padding()
            .navigationTitle("Export Data")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarItems(
                leading: Button("Cancel") {
                    presentationMode.wrappedValue.dismiss()
                }
            )
        }
    }
    
    private func exportData() {
        isExporting = true
        
        DispatchQueue.global(qos: .userInitiated).async {
            // Create export data
            let exportData = DataExportManager.createExportData()
            
            DispatchQueue.main.async {
                isExporting = false
                
                // Save to Files app
                DataExportManager.saveToFiles(exportData) { success in
                    if success {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Supporting Types and Extensions

enum UnitSystem: String, CaseIterable, Identifiable {
    case metric = "metric"
    case imperial = "imperial"
    
    var id: String { rawValue }
    
    var localizedName: String {
        switch self {
        case .metric: return "Metric (kg, cm)"
        case .imperial: return "Imperial (lbs, in)"
        }
    }
}

enum TextSize: String, CaseIterable, Identifiable {
    case small = "small"
    case medium = "medium"
    case large = "large"
    case extraLarge = "extraLarge"
    
    var id: String { rawValue }
    
    var scaleFactor: CGFloat {
        switch self {
        case .small: return 0.9
        case .medium: return 1.0
        case .large: return 1.1
        case .extraLarge: return 1.2
        }
    }
}

extension Bundle {
    var appVersion: String {
        return infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
    }
    
    var buildNumber: String {
        return infoDictionary?["CFBundleVersion"] as? String ?? "Unknown"
    }
}

// MARK: - Data Export Manager

class DataExportManager {
    static func createExportData() -> [String: Any] {
        return [
            "export_date": ISO8601DateFormatter().string(from: Date()),
            "app_version": Bundle.main.appVersion,
            "preferences": UserPreferences.shared.exportData(),
            "calculation_count": CalculationHistoryManager.shared.getCalculationCount(),
            "note": "This export contains no patient health information (PHI)"
        ]
    }
    
    static func saveToFiles(_ data: [String: Any], completion: @escaping (Bool) -> Void) {
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: data, options: .prettyPrinted)
            let fileName = "vancomyzer_export_\(DateFormatter.fileNameFormatter.string(from: Date())).json"
            
            let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            let fileURL = documentsPath.appendingPathComponent(fileName)
            
            try jsonData.write(to: fileURL)
            completion(true)
        } catch {
            completion(false)
        }
    }
}

extension DateFormatter {
    static let fileNameFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        return formatter
    }()
}

extension UserPreferences {
    func exportData() -> [String: Any] {
        return [
            "language": selectedLanguage,
            "color_scheme": colorScheme?.rawValue ?? "system",
            "unit_system": unitSystem.rawValue,
            "default_population": defaultPopulation.rawValue,
            "analytics_enabled": analyticsEnabled,
            "auto_save_enabled": autoSaveCalculations
        ]
    }
    
    func resetToDefaults() {
        selectedLanguage = "en"
        colorScheme = nil
        unitSystem = .metric
        defaultPopulation = .adult
        defaultCrClMethod = .ibw
        analyticsEnabled = false
        crashReportingEnabled = false
        autoSaveCalculations = true
        showClinicalWarnings = true
        enhancedVoiceOver = false
        highContrastMode = false
        reduceMotion = false
        textSize = .medium
    }
}

#Preview {
    SettingsView()
        .environmentObject(UserPreferences())
}

