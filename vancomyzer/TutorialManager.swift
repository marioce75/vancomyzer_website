import SwiftUI

// MARK: - Tutorial Manager

@MainActor
class TutorialManager: ObservableObject {
    static let shared = TutorialManager()
    
    @Published var hasCompletedTutorial: Bool {
        didSet {
            UserDefaults.standard.set(hasCompletedTutorial, forKey: "tutorial_completed")
        }
    }
    
    @Published var currentStep: TutorialStep?
    @Published var isShowingTutorial = false
    
    private init() {
        self.hasCompletedTutorial = UserDefaults.standard.bool(forKey: "tutorial_completed")
    }
    
    func startTutorial() {
        currentStep = .welcome
        isShowingTutorial = true
        
        AnalyticsManager.shared.trackFeatureUsage("tutorial_started")
    }
    
    func nextStep() {
        guard let current = currentStep else { return }
        
        if let next = current.nextStep {
            currentStep = next
        } else {
            completeTutorial()
        }
    }
    
    func previousStep() {
        guard let current = currentStep else { return }
        currentStep = current.previousStep
    }
    
    func skipTutorial() {
        completeTutorial()
        AnalyticsManager.shared.trackFeatureUsage("tutorial_skipped")
    }
    
    private func completeTutorial() {
        hasCompletedTutorial = true
        isShowingTutorial = false
        currentStep = nil
        
        AnalyticsManager.shared.trackFeatureUsage("tutorial_completed")
    }
    
    func resetTutorial() {
        hasCompletedTutorial = false
        currentStep = nil
        isShowingTutorial = false
    }
}

// MARK: - Tutorial Steps

enum TutorialStep: String, CaseIterable {
    case welcome = "welcome"
    case patientInput = "patient_input"
    case populationSelection = "population_selection"
    case calculation = "calculation"
    case results = "results"
    case bayesianIntro = "bayesian_intro"
    case levelEntry = "level_entry"
    case bayesianResults = "bayesian_results"
    case guidelines = "guidelines"
    case settings = "settings"
    case completion = "completion"
    
    var title: String {
        switch self {
        case .welcome:
            return NSLocalizedString("tutorial_welcome_title", comment: "Welcome to Vancomyzer")
        case .patientInput:
            return NSLocalizedString("tutorial_patient_input_title", comment: "Patient Information")
        case .populationSelection:
            return NSLocalizedString("tutorial_population_title", comment: "Population Selection")
        case .calculation:
            return NSLocalizedString("tutorial_calculation_title", comment: "Dosing Calculation")
        case .results:
            return NSLocalizedString("tutorial_results_title", comment: "Understanding Results")
        case .bayesianIntro:
            return NSLocalizedString("tutorial_bayesian_intro_title", comment: "Bayesian Optimization")
        case .levelEntry:
            return NSLocalizedString("tutorial_level_entry_title", comment: "Vancomycin Levels")
        case .bayesianResults:
            return NSLocalizedString("tutorial_bayesian_results_title", comment: "Optimized Dosing")
        case .guidelines:
            return NSLocalizedString("tutorial_guidelines_title", comment: "Clinical Guidelines")
        case .settings:
            return NSLocalizedString("tutorial_settings_title", comment: "App Settings")
        case .completion:
            return NSLocalizedString("tutorial_completion_title", comment: "Tutorial Complete")
        }
    }
    
    var description: String {
        switch self {
        case .welcome:
            return NSLocalizedString("tutorial_welcome_desc", comment: "Welcome to Vancomyzer, your evidence-based vancomycin dosing companion. This tutorial will guide you through all the features.")
        case .patientInput:
            return NSLocalizedString("tutorial_patient_input_desc", comment: "Start by entering patient demographics and clinical information. All fields are validated for clinical plausibility.")
        case .populationSelection:
            return NSLocalizedString("tutorial_population_desc", comment: "Select the appropriate population type. Each has specialized dosing algorithms based on current guidelines.")
        case .calculation:
            return NSLocalizedString("tutorial_calculation_desc", comment: "Tap Calculate to get evidence-based dosing recommendations with pharmacokinetic parameters.")
        case .results:
            return NSLocalizedString("tutorial_results_desc", comment: "Review dosing recommendations, predicted levels, and clinical guidance for optimal patient care.")
        case .bayesianIntro:
            return NSLocalizedString("tutorial_bayesian_intro_desc", comment: "Use Bayesian optimization to personalize dosing based on measured vancomycin levels.")
        case .levelEntry:
            return NSLocalizedString("tutorial_level_entry_desc", comment: "Enter vancomycin levels with timing information for precise pharmacokinetic modeling.")
        case .bayesianResults:
            return NSLocalizedString("tutorial_bayesian_results_desc", comment: "Get optimized dosing recommendations with confidence intervals based on patient-specific parameters.")
        case .guidelines:
            return NSLocalizedString("tutorial_guidelines_desc", comment: "Access comprehensive clinical guidelines for all patient populations and monitoring recommendations.")
        case .settings:
            return NSLocalizedString("tutorial_settings_desc", comment: "Customize your experience with language, units, and clinical preferences.")
        case .completion:
            return NSLocalizedString("tutorial_completion_desc", comment: "You're ready to use Vancomyzer! Access this tutorial anytime from Settings > Help.")
        }
    }
    
    var imageName: String {
        switch self {
        case .welcome:
            return "heart.text.square.fill"
        case .patientInput:
            return "person.text.rectangle.fill"
        case .populationSelection:
            return "person.3.sequence.fill"
        case .calculation:
            return "function"
        case .results:
            return "chart.line.uptrend.xyaxis"
        case .bayesianIntro:
            return "brain.head.profile"
        case .levelEntry:
            return "drop.triangle.fill"
        case .bayesianResults:
            return "target"
        case .guidelines:
            return "book.fill"
        case .settings:
            return "gearshape.fill"
        case .completion:
            return "checkmark.seal.fill"
        }
    }
    
    var nextStep: TutorialStep? {
        let allSteps = TutorialStep.allCases
        guard let currentIndex = allSteps.firstIndex(of: self),
              currentIndex < allSteps.count - 1 else { return nil }
        return allSteps[currentIndex + 1]
    }
    
    var previousStep: TutorialStep? {
        let allSteps = TutorialStep.allCases
        guard let currentIndex = allSteps.firstIndex(of: self),
              currentIndex > 0 else { return nil }
        return allSteps[currentIndex - 1]
    }
    
    var stepNumber: Int {
        return TutorialStep.allCases.firstIndex(of: self)! + 1
    }
    
    var totalSteps: Int {
        return TutorialStep.allCases.count
    }
}

// MARK: - Tutorial View

struct TutorialView: View {
    @StateObject private var tutorialManager = TutorialManager.shared
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                if let currentStep = tutorialManager.currentStep {
                    // Progress Bar
                    ProgressView(value: Double(currentStep.stepNumber), total: Double(currentStep.totalSteps))
                        .progressViewStyle(LinearProgressViewStyle(tint: .vancoBlue))
                        .padding()
                    
                    // Step Content
                    ScrollView {
                        VStack(spacing: 24) {
                            // Step Image
                            Image(systemName: currentStep.imageName)
                                .font(.system(size: 60))
                                .foregroundColor(.vancoBlue)
                                .padding(.top)
                            
                            // Step Title
                            Text(currentStep.title)
                                .font(.largeTitle)
                                .fontWeight(.bold)
                                .multilineTextAlignment(.center)
                            
                            // Step Description
                            Text(currentStep.description)
                                .font(.body)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal)
                            
                            // Interactive Content
                            tutorialInteractiveContent(for: currentStep)
                            
                            Spacer(minLength: 100)
                        }
                        .padding()
                    }
                    
                    // Navigation Controls
                    VStack(spacing: 16) {
                        HStack {
                            // Previous Button
                            if currentStep.previousStep != nil {
                                Button(action: tutorialManager.previousStep) {
                                    HStack {
                                        Image(systemName: "chevron.left")
                                        Text("Previous")
                                    }
                                }
                                .buttonStyle(VancoSecondaryButtonStyle())
                            }
                            
                            Spacer()
                            
                            // Step Indicator
                            Text("\(currentStep.stepNumber) of \(currentStep.totalSteps)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            Spacer()
                            
                            // Next/Complete Button
                            Button(action: tutorialManager.nextStep) {
                                HStack {
                                    Text(currentStep.nextStep != nil ? "Next" : "Complete")
                                    if currentStep.nextStep != nil {
                                        Image(systemName: "chevron.right")
                                    }
                                }
                            }
                            .buttonStyle(VancoPrimaryButtonStyle())
                        }
                        
                        // Skip Button
                        if currentStep != .completion {
                            Button("Skip Tutorial") {
                                tutorialManager.skipTutorial()
                            }
                            .font(.caption)
                            .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .background(Color(.systemBackground))
                }
            }
            .navigationTitle("Tutorial")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") {
                        dismiss()
                    }
                }
            }
        }
        .onChange(of: tutorialManager.isShowingTutorial) { isShowing in
            if !isShowing {
                dismiss()
            }
        }
    }
    
    @ViewBuilder
    private func tutorialInteractiveContent(for step: TutorialStep) -> some View {
        switch step {
        case .welcome:
            VancoCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("Evidence-Based", systemImage: "checkmark.seal.fill")
                    Label("ASHP/IDSA 2020 Guidelines", systemImage: "book.fill")
                    Label("Bayesian Optimization", systemImage: "brain.head.profile")
                    Label("Multi-Population Support", systemImage: "person.3.sequence.fill")
                }
                .foregroundColor(.vancoBlue)
            }
            
        case .patientInput:
            VancoCard {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Age:")
                        Spacer()
                        Text("45 years")
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("Weight:")
                        Spacer()
                        Text("70 kg")
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Text("Creatinine:")
                        Spacer()
                        Text("1.0 mg/dL")
                            .foregroundColor(.secondary)
                    }
                }
            }
            
        case .populationSelection:
            HStack(spacing: 16) {
                ForEach([PopulationType.adult, .pediatric, .neonate], id: \.self) { population in
                    VancoCard {
                        VStack {
                            Image(systemName: population.iconName)
                                .font(.title2)
                                .foregroundColor(.vancoBlue)
                            Text(population.displayName)
                                .font(.caption)
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            
        case .calculation:
            VancoCard {
                VStack(spacing: 12) {
                    HStack {
                        Image(systemName: "function")
                            .foregroundColor(.vancoBlue)
                        Text("Calculating...")
                        Spacer()
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                    
                    Text("Using ASHP/IDSA 2020 guidelines")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
        case .results:
            VancoCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Recommended Dosing")
                        .font(.headline)
                        .foregroundColor(.vancoBlue)
                    
                    Text("1000 mg every 12 hours")
                        .font(.title2)
                        .fontWeight(.semibold)
                    
                    HStack {
                        Text("Predicted AUC₀₋₂₄:")
                        Spacer()
                        Text("550 mg·h/L")
                    }
                    .font(.caption)
                    .foregroundColor(.secondary)
                }
            }
            
        case .bayesianIntro:
            VancoCard {
                VStack(spacing: 12) {
                    Image(systemName: "brain.head.profile")
                        .font(.title)
                        .foregroundColor(.vancoBlue)
                    
                    Text("Personalized Dosing")
                        .font(.headline)
                    
                    Text("Uses measured levels to optimize dosing for individual patients")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                }
            }
            
        case .levelEntry:
            VancoCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Vancomycin Level Entry")
                        .font(.headline)
                        .foregroundColor(.vancoBlue)
                    
                    HStack {
                        Text("Level:")
                        Spacer()
                        Text("15.2 mg/L")
                    }
                    
                    HStack {
                        Text("Time after dose:")
                        Spacer()
                        Text("1.0 hours")
                    }
                    
                    HStack {
                        Text("Dose number:")
                        Spacer()
                        Text("3")
                    }
                }
                .font(.caption)
            }
            
        case .bayesianResults:
            VancoCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Optimized Dosing")
                        .font(.headline)
                        .foregroundColor(.vancoBlue)
                    
                    Text("1250 mg every 12 hours")
                        .font(.title3)
                        .fontWeight(.semibold)
                    
                    Text("95% CI: 1150-1350 mg")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
        case .guidelines:
            VancoCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Clinical Guidelines")
                        .font(.headline)
                        .foregroundColor(.vancoBlue)
                    
                    Label("ASHP/IDSA 2020", systemImage: "checkmark.circle.fill")
                    Label("Pediatric Guidelines", systemImage: "checkmark.circle.fill")
                    Label("Monitoring Protocols", systemImage: "checkmark.circle.fill")
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
            
        case .settings:
            VancoCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Customization Options")
                        .font(.headline)
                        .foregroundColor(.vancoBlue)
                    
                    Label("Language & Localization", systemImage: "globe")
                    Label("Units & Preferences", systemImage: "ruler")
                    Label("Privacy Controls", systemImage: "hand.raised.fill")
                }
                .font(.caption)
                .foregroundColor(.secondary)
            }
            
        case .completion:
            VancoCard {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 40))
                        .foregroundColor(.green)
                    
                    Text("You're Ready!")
                        .font(.headline)
                        .foregroundColor(.vancoBlue)
                    
                    Text("Access this tutorial anytime from Settings > Help & Tutorial")
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

// MARK: - Tutorial Overlay

struct TutorialOverlay: View {
    let step: TutorialStep
    let targetFrame: CGRect
    let onNext: () -> Void
    let onSkip: () -> Void
    
    var body: some View {
        ZStack {
            // Dimmed background
            Color.black.opacity(0.7)
                .ignoresSafeArea()
            
            // Highlight area
            RoundedRectangle(cornerRadius: 8)
                .frame(width: targetFrame.width + 16, height: targetFrame.height + 16)
                .position(x: targetFrame.midX, y: targetFrame.midY)
                .blendMode(.destinationOut)
            
            // Tutorial content
            VStack(spacing: 16) {
                VancoCard {
                    VStack(spacing: 12) {
                        Text(step.title)
                            .font(.headline)
                            .foregroundColor(.vancoBlue)
                        
                        Text(step.description)
                            .font(.body)
                            .multilineTextAlignment(.center)
                        
                        HStack {
                            Button("Skip") {
                                onSkip()
                            }
                            .buttonStyle(VancoSecondaryButtonStyle())
                            
                            Spacer()
                            
                            Button("Next") {
                                onNext()
                            }
                            .buttonStyle(VancoPrimaryButtonStyle())
                        }
                    }
                }
                .padding()
            }
            .position(x: UIScreen.main.bounds.width / 2, 
                     y: targetFrame.maxY + 100)
        }
        .compositingGroup()
    }
}

// MARK: - Tutorial Extensions

extension PopulationType {
    var iconName: String {
        switch self {
        case .adult:
            return "person.fill"
        case .pediatric:
            return "figure.child"
        case .neonate:
            return "figure.child.circle.fill"
        }
    }
    
    var displayName: String {
        switch self {
        case .adult:
            return NSLocalizedString("population_adult", comment: "Adult")
        case .pediatric:
            return NSLocalizedString("population_pediatric", comment: "Pediatric")
        case .neonate:
            return NSLocalizedString("population_neonate", comment: "Neonate")
        }
    }
}

