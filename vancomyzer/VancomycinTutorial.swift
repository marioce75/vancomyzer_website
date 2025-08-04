import SwiftUI

// MARK: - Vancomycin Tutorial Main View

struct VancomycinTutorial: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var tutorialManager = TutorialManager.shared
    @State private var currentPage = 0
    
    private let tutorialPages: [TutorialPage] = [
        TutorialPage(
            title: "Welcome to Vancomyzer",
            description: "Your evidence-based vancomycin dosing companion for clinical practice.",
            content: .welcome
        ),
        TutorialPage(
            title: "Population-Based Dosing",
            description: "Choose the appropriate patient population for accurate dosing calculations.",
            content: .populations
        ),
        TutorialPage(
            title: "Patient Information",
            description: "Enter demographic and clinical data with built-in validation.",
            content: .patientInput
        ),
        TutorialPage(
            title: "Dosing Calculations",
            description: "Get evidence-based recommendations following ASHP/IDSA 2020 guidelines.",
            content: .calculations
        ),
        TutorialPage(
            title: "Bayesian Optimization",
            description: "Personalize dosing using measured vancomycin levels for optimal therapy.",
            content: .bayesian
        ),
        TutorialPage(
            title: "Clinical Monitoring",
            description: "Follow comprehensive monitoring guidelines for safe and effective therapy.",
            content: .monitoring
        ),
        TutorialPage(
            title: "Ready to Start",
            description: "You're now ready to use Vancomyzer for evidence-based vancomycin dosing.",
            content: .completion
        )
    ]
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Progress Bar
                ProgressView(value: Double(currentPage + 1), total: Double(tutorialPages.count))
                    .progressViewStyle(LinearProgressViewStyle(tint: .vancoBlue))
                    .padding()
                
                // Tutorial Content
                TabView(selection: $currentPage) {
                    ForEach(tutorialPages.indices, id: \.self) { index in
                        TutorialPageView(page: tutorialPages[index])
                            .tag(index)
                    }
                }
                .tabViewStyle(PageTabViewStyle(indexDisplayMode: .never))
                
                // Navigation Controls
                HStack(spacing: 16) {
                    // Previous Button
                    if currentPage > 0 {
                        Button(action: previousPage) {
                            HStack {
                                Image(systemName: "chevron.left")
                                Text("Previous")
                            }
                        }
                        .buttonStyle(VancoSecondaryButtonStyle())
                        .frame(width: 120)
                    } else {
                        Spacer()
                            .frame(width: 120)
                    }
                    
                    Spacer()
                    
                    // Page Indicator
                    HStack(spacing: 8) {
                        ForEach(0..<tutorialPages.count, id: \.self) { index in
                            Circle()
                                .fill(index <= currentPage ? Color.vancoBlue : Color.gray.opacity(0.3))
                                .frame(width: 8, height: 8)
                                .animation(.easeInOut(duration: 0.2), value: currentPage)
                        }
                    }
                    
                    Spacer()
                    
                    // Next/Complete Button
                    Button(action: nextPage) {
                        HStack {
                            Text(currentPage < tutorialPages.count - 1 ? "Next" : "Get Started")
                            if currentPage < tutorialPages.count - 1 {
                                Image(systemName: "chevron.right")
                            }
                        }
                    }
                    .buttonStyle(VancoPrimaryButtonStyle())
                    .frame(width: 120)
                }
                .padding()
                .background(Color(.systemBackground))
                .shadow(color: .black.opacity(0.1), radius: 4, x: 0, y: -2)
            }
            .navigationTitle("Tutorial")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Skip") {
                        completeTutorial()
                    }
                    .foregroundColor(.secondary)
                }
                
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
    }
    
    private func previousPage() {
        withAnimation(.easeInOut(duration: 0.3)) {
            if currentPage > 0 {
                currentPage -= 1
            }
        }
    }
    
    private func nextPage() {
        withAnimation(.easeInOut(duration: 0.3)) {
            if currentPage < tutorialPages.count - 1 {
                currentPage += 1
            } else {
                completeTutorial()
            }
        }
    }
    
    private func completeTutorial() {
        tutorialManager.hasCompletedTutorial = true
        AnalyticsManager.shared.trackFeatureUsage("tutorial_completed", parameters: [
            "pages_viewed": currentPage + 1,
            "completion_method": currentPage < tutorialPages.count - 1 ? "skipped" : "completed"
        ])
        dismiss()
    }
}

// MARK: - Tutorial Page View

struct TutorialPageView: View {
    let page: TutorialPage
    
    var body: some View {
        ScrollView {
            VStack(spacing: 30) {
                Spacer(minLength: 20)
                
                // Page Content
                page.content.view
                
                // Text Content
                VStack(spacing: 16) {
                    Text(page.title)
                        .font(.largeTitle)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)
                    
                    Text(page.description)
                        .font(.title3)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }
                
                Spacer(minLength: 50)
            }
            .padding()
        }
    }
}

// MARK: - Tutorial Page Model

struct TutorialPage {
    let title: String
    let description: String
    let content: TutorialContent
}

enum TutorialContent {
    case welcome
    case populations
    case patientInput
    case calculations
    case bayesian
    case monitoring
    case completion
    
    @ViewBuilder
    var view: some View {
        switch self {
        case .welcome:
            VancoCard {
                VStack(spacing: 20) {
                    Image(systemName: "cross.case.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.vancoBlue)
                    
                    VStack(spacing: 12) {
                        HStack(spacing: 16) {
                            Label("Evidence-Based", systemImage: "checkmark.seal.fill")
                                .foregroundColor(.clinicalSafe)
                            
                            Label("ASHP/IDSA 2020", systemImage: "book.fill")
                                .foregroundColor(.vancoBlue)
                        }
                        .font(.caption)
                        
                        HStack(spacing: 16) {
                            Label("Bayesian Optimization", systemImage: "brain.head.profile")
                                .foregroundColor(.vancoOrange)
                            
                            Label("Multi-Population", systemImage: "person.3.sequence.fill")
                                .foregroundColor(.vancoBlue)
                        }
                        .font(.caption)
                    }
                }
            }
            
        case .populations:
            VStack(spacing: 16) {
                HStack(spacing: 12) {
                    PopulationTutorialCard(
                        icon: "person.fill",
                        title: "Adult",
                        ageRange: "≥18 years",
                        color: .vancoBlue
                    )
                    
                    PopulationTutorialCard(
                        icon: "figure.child",
                        title: "Pediatric",
                        ageRange: "1 mo - 17 yr",
                        color: .vancoOrange
                    )
                    
                    PopulationTutorialCard(
                        icon: "figure.child.circle",
                        title: "Neonate",
                        ageRange: "≤1 month",
                        color: .vancoGreen
                    )
                }
                
                VancoCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Population-Specific Features")
                            .font(.headline)
                            .foregroundColor(.vancoBlue)
                        
                        Label("Age-appropriate PK parameters", systemImage: "function")
                        Label("Specialized dosing algorithms", systemImage: "calculator")
                        Label("Population-specific monitoring", systemImage: "chart.line.uptrend.xyaxis")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
            
        case .patientInput:
            VStack(spacing: 16) {
                VancoCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Patient Demographics")
                            .font(.headline)
                            .foregroundColor(.vancoBlue)
                        
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Age:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("45 years")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                            }
                            
                            Spacer()
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Weight:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("70 kg")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                            }
                            
                            Spacer()
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("SCr:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                Text("1.0 mg/dL")
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                            }
                        }
                    }
                }
                
                VancoCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Built-in Validation")
                            .font(.headline)
                            .foregroundColor(.vancoBlue)
                        
                        Label("Clinical range checking", systemImage: "checkmark.circle.fill")
                        Label("Population-specific limits", systemImage: "person.crop.circle.badge.checkmark")
                        Label("Real-time feedback", systemImage: "exclamationmark.triangle.fill")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
            
        case .calculations:
            VStack(spacing: 16) {
                VancoCard {
                    VStack(spacing: 12) {
                        HStack {
                            Image(systemName: "function")
                                .font(.title2)
                                .foregroundColor(.vancoBlue)
                            
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Dosing Calculation")
                                    .font(.headline)
                                    .fontWeight(.semibold)
                                
                                Text("ASHP/IDSA 2020 Guidelines")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                        }
                        
                        Divider()
                        
                        VStack(alignment: .leading, spacing: 8) {
                            Text("1000 mg every 12 hours")
                                .font(.title2)
                                .fontWeight(.bold)
                                .foregroundColor(.vancoBlue)
                            
                            HStack {
                                Text("Predicted AUC₀₋₂₄:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                Text("450 mg·h/L")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                            }
                            
                            HStack {
                                Text("Predicted Trough:")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                
                                Spacer()
                                
                                Text("12.5 mg/L")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                            }
                        }
                    }
                }
            }
            
        case .bayesian:
            VStack(spacing: 16) {
                VancoCard {
                    VStack(spacing: 12) {
                        Image(systemName: "brain.head.profile")
                            .font(.system(size: 50))
                            .foregroundColor(.vancoBlue)
                        
                        Text("Bayesian Optimization")
                            .font(.headline)
                            .fontWeight(.semibold)
                        
                        Text("Uses measured vancomycin levels to personalize dosing for individual patients")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                }
                
                VancoCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Benefits")
                            .font(.headline)
                            .foregroundColor(.vancoBlue)
                        
                        Label("Patient-specific parameters", systemImage: "person.crop.circle.badge.checkmark")
                        Label("Improved target achievement", systemImage: "target")
                        Label("Confidence intervals", systemImage: "chart.bar.fill")
                        Label("Real-time optimization", systemImage: "arrow.clockwise.circle")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
            
        case .monitoring:
            VStack(spacing: 16) {
                VancoCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Monitoring Protocol")
                            .font(.headline)
                            .foregroundColor(.vancoBlue)
                        
                        VStack(alignment: .leading, spacing: 6) {
                            MonitoringItem(icon: "drop.triangle.fill", text: "Levels before 4th dose")
                            MonitoringItem(icon: "clock.fill", text: "Trough: 30 min before dose")
                            MonitoringItem(icon: "heart.text.square.fill", text: "Monitor SCr every 2-3 days")
                            MonitoringItem(icon: "ear.fill", text: "Hearing assessment if >7 days")
                        }
                    }
                }
                
                VancoCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Target Ranges")
                            .font(.headline)
                            .foregroundColor(.vancoBlue)
                        
                        HStack {
                            Text("AUC₀₋₂₄:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Spacer()
                            
                            Text("400-600 mg·h/L")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.clinicalSafe)
                        }
                        
                        HStack {
                            Text("Trough:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Spacer()
                            
                            Text("10-20 mg/L")
                                .font(.caption)
                                .fontWeight(.semibold)
                                .foregroundColor(.clinicalSafe)
                        }
                    }
                }
            }
            
        case .completion:
            VancoCard {
                VStack(spacing: 20) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 80))
                        .foregroundColor(.clinicalSafe)
                    
                    VStack(spacing: 12) {
                        Text("You're Ready!")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.vancoBlue)
                        
                        Text("Start calculating evidence-based vancomycin dosing for your patients")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    
                    VStack(spacing: 8) {
                        Label("Access tutorial anytime in Settings", systemImage: "questionmark.circle")
                        Label("Contact support for questions", systemImage: "envelope")
                        Label("Regular updates with new features", systemImage: "arrow.down.circle")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
        }
    }
}

// MARK: - Supporting Views

struct PopulationTutorialCard: View {
    let icon: String
    let title: String
    let ageRange: String
    let color: Color
    
    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title)
                .foregroundColor(color)
            
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
            
            Text(ageRange)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(color, lineWidth: 1)
        )
        .cornerRadius(8)
    }
}

struct MonitoringItem: View {
    let icon: String
    let text: String
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundColor(.vancoBlue)
                .frame(width: 16)
            
            Text(text)
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
        }
    }
}

#Preview {
    VancomycinTutorial()
}