import SwiftUI

struct ContentView: View {
    @StateObject private var userPreferences = UserPreferences()
    @State private var showingOnboarding = false
    @State private var currentOnboardingStep = 0
    
    var body: some View {
        Group {
            if userPreferences.tutorialCompleted {
                MainTabView()
                    .environmentObject(userPreferences)
            } else {
                OnboardingView(isPresented: $showingOnboarding, currentStep: $currentOnboardingStep)
                    .environmentObject(userPreferences)
            }
        }
        .onAppear {
            if !userPreferences.tutorialCompleted {
                showingOnboarding = true
            }
        }
    }
}

// MARK: - Onboarding View

struct OnboardingView: View {
    @Binding var isPresented: Bool
    @Binding var currentStep: Int
    @EnvironmentObject var userPreferences: UserPreferences
    @State private var showingTutorial = false
    
    private let totalSteps = 4
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Progress indicator
                ProgressView(value: Double(currentStep), total: Double(totalSteps - 1))
                    .progressViewStyle(LinearProgressViewStyle(tint: .vancoBlue))
                    .padding(.horizontal)
                    .padding(.top)
                
                // Content
                TabView(selection: $currentStep) {
                    WelcomeStepView()
                        .tag(0)
                    
                    FeaturesStepView()
                        .tag(1)
                    
                    SettingsStepView()
                        .tag(2)
                    
                    CompletionStepView(showingTutorial: $showingTutorial)
                        .tag(3)
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                
                // Navigation buttons
                HStack {
                    if currentStep > 0 {
                        Button("Previous") {
                            withAnimation {
                                currentStep -= 1
                            }
                        }
                        .foregroundColor(.vancoBlue)
                    }
                    
                    Spacer()
                    
                    if currentStep < totalSteps - 1 {
                        Button("Next") {
                            withAnimation {
                                currentStep += 1
                            }
                        }
                        .foregroundColor(.vancoBlue)
                        .fontWeight(.semibold)
                    } else {
                        Button("Get Started") {
                            completeOnboarding()
                        }
                        .foregroundColor(.white)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(Color.vancoBlue)
                        .cornerRadius(8)
                    }
                }
                .padding()
            }
            .navigationTitle("Welcome to Vancomyzer")
            .navigationBarTitleDisplayMode(.inline)
        }
        .sheet(isPresented: $showingTutorial) {
            VancomycinTutorial()
        }
    }
    
    private func completeOnboarding() {
        userPreferences.tutorialCompleted = true
        isPresented = false
        
        // Track analytics
        AnalyticsManager.shared.track(.tutorialCompleted)
    }
}

// MARK: - Onboarding Steps

struct WelcomeStepView: View {
    var body: some View {
        VStack(spacing: 30) {
            Spacer()
            
            Image(systemName: "cross.case.fill")
                .font(.system(size: 80))
                .foregroundColor(.vancoBlue)
            
            VStack(spacing: 16) {
                Text("Welcome to Vancomyzer")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)
                
                Text("Evidence-based vancomycin dosing for healthcare professionals")
                    .font(.title3)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            VStack(alignment: .leading, spacing: 12) {
                FeatureRow(icon: "checkmark.seal.fill", text: "ASHP/IDSA 2020 Guidelines", color: .green)
                FeatureRow(icon: "brain.head.profile", text: "Bayesian Optimization", color: .vancoBlue)
                FeatureRow(icon: "globe", text: "Multi-language Support", color: .orange)
                FeatureRow(icon: "shield.fill", text: "Privacy-First Design", color: .purple)
            }
            .padding(.horizontal)
            
            Spacer()
        }
        .padding()
    }
}

struct FeaturesStepView: View {
    var body: some View {
        VStack(spacing: 30) {
            Spacer()
            
            Text("Comprehensive Dosing")
                .font(.largeTitle)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)
            
            VStack(spacing: 20) {
                PopulationCard(
                    icon: "person.fill",
                    title: "Adult Dosing",
                    description: "Cockcroft-Gault with AUC targeting",
                    color: .vancoBlue
                )
                
                PopulationCard(
                    icon: "figure.child",
                    title: "Pediatric Dosing",
                    description: "Age-based guidelines with safety limits",
                    color: .green
                )
                
                PopulationCard(
                    icon: "figure.child.circle",
                    title: "Neonatal Dosing",
                    description: "Maturation-adjusted calculations",
                    color: .orange
                )
            }
            
            Spacer()
        }
        .padding()
    }
}

struct SettingsStepView: View {
    @EnvironmentObject var userPreferences: UserPreferences
    
    var body: some View {
        VStack(spacing: 30) {
            Spacer()
            
            Text("Customize Your Experience")
                .font(.largeTitle)
                .fontWeight(.bold)
                .multilineTextAlignment(.center)
            
            VStack(spacing: 20) {
                // Language selection
                VStack(alignment: .leading, spacing: 8) {
                    Text("Language")
                        .font(.headline)
                    
                    Picker("Language", selection: $userPreferences.selectedLanguage) {
                        Text("English").tag("en")
                        Text("Español").tag("es")
                        Text("العربية").tag("ar")
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                // Theme selection
                VStack(alignment: .leading, spacing: 8) {
                    Text("Appearance")
                        .font(.headline)
                    
                    Picker("Theme", selection: $userPreferences.isDarkMode) {
                        Text("Light").tag(false)
                        Text("Dark").tag(true)
                    }
                    .pickerStyle(SegmentedPickerStyle())
                }
                
                // Analytics consent
                VStack(alignment: .leading, spacing: 8) {
                    Text("Privacy")
                        .font(.headline)
                    
                    Toggle("Help improve Vancomyzer with anonymous usage analytics", isOn: $userPreferences.analyticsEnabled)
                        .font(.subheadline)
                }
            }
            .padding(.horizontal)
            
            Text("All settings can be changed later in the Settings tab")
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            
            Spacer()
        }
        .padding()
    }
}

struct CompletionStepView: View {
    @Binding var showingTutorial: Bool
    
    var body: some View {
        VStack(spacing: 30) {
            Spacer()
            
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.green)
            
            VStack(spacing: 16) {
                Text("You're All Set!")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)
                
                Text("Ready to start calculating evidence-based vancomycin dosing")
                    .font(.title3)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            Button("View Tutorial") {
                showingTutorial = true
            }
            .foregroundColor(.vancoBlue)
            .font(.headline)
            .padding(.horizontal, 20)
            .padding(.vertical, 10)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Color.vancoBlue, lineWidth: 2)
            )
            
            Spacer()
        }
        .padding()
    }
}

// MARK: - Supporting Views

struct FeatureRow: View {
    let icon: String
    let text: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .foregroundColor(color)
                .frame(width: 24)
            
            Text(text)
                .font(.subheadline)
            
            Spacer()
        }
    }
}

struct PopulationCard: View {
    let icon: String
    let title: String
    let description: String
    let color: Color
    
    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)
                .frame(width: 40)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                
                Text(description)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

// MARK: - Color Extensions

extension Color {
    static let vancoBlue = Color("VancoBlue") ?? Color.blue
    static let vancoOrange = Color("VancoOrange") ?? Color.orange
}

// MARK: - Analytics Manager Stub

class AnalyticsManager: ObservableObject {
    static let shared = AnalyticsManager()
    
    private init() {}
    
    func track(_ event: AnalyticsEvent, parameters: [String: Any] = [:]) {
        // Implementation would go here
        print("Analytics: \(event.rawValue) - \(parameters)")
    }
}

#Preview {
    ContentView()
}

