import SwiftUI

@main
struct VancomyzerApp: App {
    @AppStorage("hasAcceptedEULA") private var hasAcceptedEULA = false
    @AppStorage("isDarkMode") private var isDarkMode = false
    @StateObject private var localizationManager = LocalizationManager()
    @StateObject private var themeManager = ThemeManager()
    @StateObject private var analyticsManager = AnalyticsManager()
    
    var body: some Scene {
        WindowGroup {
            Group {
                if hasAcceptedEULA {
                    MainTabView()
                } else {
                    EULAView()
                }
            }
            .environmentObject(localizationManager)
            .environmentObject(themeManager)
            .environmentObject(analyticsManager)
            .preferredColorScheme(isDarkMode ? .dark : .light)
            .onAppear {
                setupApp()
            }
        }
    }
    
    private func setupApp() {
        // Initialize analytics (opt-in only)
        analyticsManager.initialize()
        
        // Set up crash reporting
        CrashReportingManager.shared.initialize()
        
        // Configure theme
        themeManager.configure()
    }
}

// MARK: - EULA View
struct EULAView: View {
    @AppStorage("hasAcceptedEULA") private var hasAcceptedEULA = false
    @State private var hasScrolledToBottom = false
    @State private var scrollOffset: CGFloat = 0
    @EnvironmentObject var localizationManager: LocalizationManager
    @EnvironmentObject var themeManager: ThemeManager
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Header
                headerView
                
                // EULA Content
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 16) {
                            eulaContent
                        }
                        .padding()
                        .background(
                            GeometryReader { geometry in
                                Color.clear
                                    .preference(key: ScrollOffsetPreferenceKey.self, value: geometry.frame(in: .named("scroll")).minY)
                            }
                        )
                        
                        // Bottom marker for scroll detection
                        Color.clear
                            .frame(height: 1)
                            .id("bottom")
                            .onAppear {
                                hasScrolledToBottom = true
                            }
                    }
                    .coordinateSpace(name: "scroll")
                    .onPreferenceChange(ScrollOffsetPreferenceKey.self) { value in
                        scrollOffset = value
                    }
                    .onAppear {
                        // Auto-scroll to show there's more content
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                            withAnimation(.easeInOut(duration: 2.0)) {
                                proxy.scrollTo("bottom", anchor: .bottom)
                            }
                        }
                    }
                }
                
                // Accept Button
                acceptButtonView
            }
            .navigationBarHidden(true)
        }
        .navigationViewStyle(StackNavigationViewStyle())
    }
    
    private var headerView: some View {
        VStack(spacing: 16) {
            Image(systemName: "doc.text.fill")
                .font(.system(size: 60))
                .foregroundColor(VancoTheme.primaryColor)
            
            Text(localizationManager.localizedString("eula.title"))
                .font(.title)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)
            
            Text(localizationManager.localizedString("eula.subtitle"))
                .font(.subheadline)
                .foregroundColor(VancoTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(Color(.systemGroupedBackground))
    }
    
    private var acceptButtonView: some View {
        VStack(spacing: 12) {
            if !hasScrolledToBottom {
                Text(localizationManager.localizedString("eula.scroll_instruction"))
                    .font(.caption)
                    .foregroundColor(VancoTheme.textSecondary)
                    .multilineTextAlignment(.center)
            }
            
            Button(action: {
                hasAcceptedEULA = true
                AnalyticsManager.shared.track(.eulaAccepted)
            }) {
                HStack {
                    Image(systemName: "checkmark.circle.fill")
                    Text(localizationManager.localizedString("eula.accept_button"))
                }
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(hasScrolledToBottom ? VancoTheme.primaryColor : Color.gray)
                .cornerRadius(12)
            }
            .disabled(!hasScrolledToBottom)
            .accessibilityLabel(localizationManager.localizedString("eula.accept_button"))
            .accessibilityHint(hasScrolledToBottom ? 
                localizationManager.localizedString("eula.accept_hint") : 
                localizationManager.localizedString("eula.scroll_hint"))
        }
        .padding()
        .background(Color(.systemGroupedBackground))
    }
    
    private var eulaContent: some View {
        VStack(alignment: .leading, spacing: 16) {
            Group {
                Text(localizationManager.localizedString("eula.main_title"))
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text(localizationManager.localizedString("eula.last_updated", Date().formatted(date: .abbreviated, time: .omitted)))
                    .font(.caption)
                    .foregroundColor(VancoTheme.textSecondary)
                
                Text(localizationManager.localizedString("eula.important_notice"))
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.red)
                
                Text(localizationManager.localizedString("eula.introduction"))
                
                sectionHeader(localizationManager.localizedString("eula.medical_disclaimer_title"))
                
                Text(localizationManager.localizedString("eula.medical_disclaimer_warning"))
                    .fontWeight(.bold)
                    .foregroundColor(.red)
                
                ForEach(1...5, id: \.self) { index in
                    Text(localizationManager.localizedString("eula.medical_disclaimer_\(index)"))
                }
                
                sectionHeader(localizationManager.localizedString("eula.intended_use_title"))
                
                Text(localizationManager.localizedString("eula.intended_use_intro"))
                ForEach(1...4, id: \.self) { index in
                    Text(localizationManager.localizedString("eula.intended_use_\(index)"))
                }
                
                sectionHeader(localizationManager.localizedString("eula.limitations_title"))
                
                ForEach(1...5, id: \.self) { index in
                    Text(localizationManager.localizedString("eula.limitations_\(index)"))
                }
                
                sectionHeader(localizationManager.localizedString("eula.no_warranty_title"))
                
                Text(localizationManager.localizedString("eula.no_warranty_text"))
                
                sectionHeader(localizationManager.localizedString("eula.liability_title"))
                
                Text(localizationManager.localizedString("eula.liability_text"))
                
                sectionHeader(localizationManager.localizedString("eula.professional_responsibility_title"))
                
                Text(localizationManager.localizedString("eula.professional_responsibility_intro"))
                ForEach(1...5, id: \.self) { index in
                    Text(localizationManager.localizedString("eula.professional_responsibility_\(index)"))
                }
                
                sectionHeader(localizationManager.localizedString("eula.data_privacy_title"))
                
                ForEach(1...4, id: \.self) { index in
                    Text(localizationManager.localizedString("eula.data_privacy_\(index)"))
                }
                
                sectionHeader(localizationManager.localizedString("eula.updates_title"))
                
                ForEach(1...3, id: \.self) { index in
                    Text(localizationManager.localizedString("eula.updates_\(index)"))
                }
                
                sectionHeader(localizationManager.localizedString("eula.governing_law_title"))
                
                Text(localizationManager.localizedString("eula.governing_law_text"))
                
                sectionHeader(localizationManager.localizedString("eula.acceptance_title"))
                
                Text(localizationManager.localizedString("eula.acceptance_text"))
                
                Text(localizationManager.localizedString("eula.emergency_notice"))
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.red)
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
            }
        }
    }
    
    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.headline)
            .fontWeight(.bold)
            .foregroundColor(VancoTheme.primaryColor)
            .padding(.top, 8)
    }
}

// MARK: - Scroll Offset Preference Key
struct ScrollOffsetPreferenceKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

