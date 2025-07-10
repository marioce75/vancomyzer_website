import SwiftUI
import UIKit

// MARK: - Color Extensions

extension Color {
    static let vancoBlue = Color("VancoBlue") ?? Color.blue
    static let vancoOrange = Color("VancoOrange") ?? Color.orange
    static let vancoGreen = Color("VancoGreen") ?? Color.green
    static let vancoRed = Color("VancoRed") ?? Color.red
    
    // Semantic colors
    static let primaryBackground = Color(.systemBackground)
    static let secondaryBackground = Color(.secondarySystemBackground)
    static let tertiaryBackground = Color(.tertiarySystemBackground)
    
    static let primaryText = Color(.label)
    static let secondaryText = Color(.secondaryLabel)
    static let tertiaryText = Color(.tertiaryLabel)
    
    // Clinical status colors
    static let clinicalNormal = Color.green
    static let clinicalWarning = Color.orange
    static let clinicalCritical = Color.red
    static let clinicalInfo = Color.blue
}

// MARK: - Button Styles

struct PrimaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isEnabled ? Color.vancoBlue : Color.gray)
                    .opacity(configuration.isPressed ? 0.8 : 1.0)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .fontWeight(.medium)
            .foregroundColor(isEnabled ? .vancoBlue : .gray)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(isEnabled ? Color.vancoBlue : Color.gray, lineWidth: 2)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color.clear)
                    )
            )
            .opacity(configuration.isPressed ? 0.7 : 1.0)
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct DestructiveButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var isEnabled
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .fontWeight(.semibold)
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(isEnabled ? Color.red : Color.gray)
                    .opacity(configuration.isPressed ? 0.8 : 1.0)
            )
            .scaleEffect(configuration.isPressed ? 0.98 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

struct CompactButtonStyle: ButtonStyle {
    let color: Color
    
    init(color: Color = .vancoBlue) {
        self.color = color
    }
    
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline)
            .fontWeight(.medium)
            .foregroundColor(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(color)
                    .opacity(configuration.isPressed ? 0.8 : 1.0)
            )
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(.easeInOut(duration: 0.1), value: configuration.isPressed)
    }
}

// MARK: - Card Components

struct VancoCard<Content: View>: View {
    let content: Content
    let padding: CGFloat
    let cornerRadius: CGFloat
    
    init(
        padding: CGFloat = 16,
        cornerRadius: CGFloat = 12,
        @ViewBuilder content: () -> Content
    ) {
        self.content = content()
        self.padding = padding
        self.cornerRadius = cornerRadius
    }
    
    var body: some View {
        content
            .padding(padding)
            .background(Color.secondaryBackground)
            .cornerRadius(cornerRadius)
            .shadow(color: .black.opacity(0.05), radius: 2, x: 0, y: 1)
    }
}

struct InfoCard: View {
    let title: String
    let message: String
    let type: InfoType
    
    enum InfoType {
        case info, warning, error, success
        
        var color: Color {
            switch self {
            case .info: return .clinicalInfo
            case .warning: return .clinicalWarning
            case .error: return .clinicalCritical
            case .success: return .clinicalNormal
            }
        }
        
        var icon: String {
            switch self {
            case .info: return "info.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .error: return "xmark.circle.fill"
            case .success: return "checkmark.circle.fill"
            }
        }
    }
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: type.icon)
                .font(.title3)
                .foregroundColor(type.color)
            
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                
                Text(message)
                    .font(.subheadline)
                    .fixedSize(horizontal: false, vertical: true)
            }
            
            Spacer()
        }
        .padding()
        .background(type.color.opacity(0.1))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(type.color, lineWidth: 1)
        )
        .cornerRadius(12)
    }
}

// MARK: - Input Components

struct VancoTextField: View {
    let title: String
    let placeholder: String
    @Binding var text: String
    let keyboardType: UIKeyboardType
    let validation: ValidationResult?
    let isRequired: Bool
    
    init(
        title: String,
        placeholder: String = "",
        text: Binding<String>,
        keyboardType: UIKeyboardType = .default,
        validation: ValidationResult? = nil,
        isRequired: Bool = false
    ) {
        self.title = title
        self.placeholder = placeholder
        self._text = text
        self.keyboardType = keyboardType
        self.validation = validation
        self.isRequired = isRequired
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                if isRequired {
                    Text("*")
                        .foregroundColor(.red)
                }
                
                Spacer()
            }
            
            TextField(placeholder, text: $text)
                .keyboardType(keyboardType)
                .textFieldStyle(VancoTextFieldStyle(validation: validation))
            
            if let validation = validation, !validation.isValid {
                Text(validation.message)
                    .font(.caption)
                    .foregroundColor(.red)
            }
        }
    }
}

struct VancoTextFieldStyle: TextFieldStyle {
    let validation: ValidationResult?
    
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding()
            .background(Color.tertiaryBackground)
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(borderColor, lineWidth: 1)
            )
            .cornerRadius(8)
    }
    
    private var borderColor: Color {
        guard let validation = validation else { return Color.gray.opacity(0.3) }
        return validation.isValid ? Color.gray.opacity(0.3) : Color.red
    }
}

struct VancoPicker<SelectionValue: Hashable, Content: View>: View {
    let title: String
    @Binding var selection: SelectionValue
    let content: Content
    let isRequired: Bool
    
    init(
        title: String,
        selection: Binding<SelectionValue>,
        isRequired: Bool = false,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self._selection = selection
        self.content = content()
        self.isRequired = isRequired
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                
                if isRequired {
                    Text("*")
                        .foregroundColor(.red)
                }
                
                Spacer()
            }
            
            Picker(title, selection: $selection) {
                content
            }
            .pickerStyle(MenuPickerStyle())
            .padding()
            .background(Color.tertiaryBackground)
            .cornerRadius(8)
        }
    }
}

// MARK: - Loading and State Components

struct VancoLoadingView: View {
    let message: String
    
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .vancoBlue))
                .scaleEffect(1.2)
            
            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.primaryBackground)
    }
}

struct VancoErrorView: View {
    let title: String
    let message: String
    let retryAction: (() -> Void)?
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 50))
                .foregroundColor(.vancoOrange)
            
            VStack(spacing: 8) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .multilineTextAlignment(.center)
                
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.secondaryText)
                    .multilineTextAlignment(.center)
            }
            
            if let retryAction = retryAction {
                Button("Try Again", action: retryAction)
                    .buttonStyle(SecondaryButtonStyle())
                    .frame(maxWidth: 200)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.primaryBackground)
    }
}

struct VancoEmptyStateView: View {
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "doc.text")
                .font(.system(size: 50))
                .foregroundColor(.gray)
            
            VStack(spacing: 8) {
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
                    .multilineTextAlignment(.center)
                
                Text(message)
                    .font(.subheadline)
                    .foregroundColor(.secondaryText)
                    .multilineTextAlignment(.center)
            }
            
            if let actionTitle = actionTitle, let action = action {
                Button(actionTitle, action: action)
                    .buttonStyle(PrimaryButtonStyle())
                    .frame(maxWidth: 200)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.primaryBackground)
    }
}

// MARK: - Section Headers

struct SectionHeader: View {
    let title: String
    let icon: String?
    let action: (() -> Void)?
    let actionTitle: String?
    
    init(
        title: String,
        icon: String? = nil,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.icon = icon
        self.actionTitle = actionTitle
        self.action = action
    }
    
    var body: some View {
        HStack {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                        .foregroundColor(.vancoBlue)
                }
                
                Text(title)
                    .font(.headline)
                    .fontWeight(.semibold)
            }
            
            Spacer()
            
            if let actionTitle = actionTitle, let action = action {
                Button(actionTitle, action: action)
                    .font(.subheadline)
                    .foregroundColor(.vancoBlue)
            }
        }
    }
}

// MARK: - Progress Indicators

struct ProgressBar: View {
    let progress: Double
    let color: Color
    let height: CGFloat
    
    init(progress: Double, color: Color = .vancoBlue, height: CGFloat = 8) {
        self.progress = max(0, min(1, progress))
        self.color = color
        self.height = height
    }
    
    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(height: height)
                
                Rectangle()
                    .fill(color)
                    .frame(width: geometry.size.width * CGFloat(progress), height: height)
                    .animation(.easeInOut(duration: 0.3), value: progress)
            }
        }
        .frame(height: height)
        .cornerRadius(height / 2)
    }
}

struct StepProgressView: View {
    let currentStep: Int
    let totalSteps: Int
    let stepTitles: [String]
    
    var body: some View {
        VStack(spacing: 16) {
            HStack {
                ForEach(0..<totalSteps, id: \.self) { step in
                    HStack {
                        Circle()
                            .fill(step < currentStep ? Color.vancoBlue : (step == currentStep ? Color.vancoOrange : Color.gray.opacity(0.3)))
                            .frame(width: 24, height: 24)
                            .overlay(
                                Text("\(step + 1)")
                                    .font(.caption)
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                            )
                        
                        if step < totalSteps - 1 {
                            Rectangle()
                                .fill(step < currentStep ? Color.vancoBlue : Color.gray.opacity(0.3))
                                .frame(height: 2)
                        }
                    }
                }
            }
            
            if stepTitles.indices.contains(currentStep) {
                Text(stepTitles[currentStep])
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .multilineTextAlignment(.center)
            }
        }
    }
}

// MARK: - Accessibility Helpers

struct AccessibilityLabel: ViewModifier {
    let label: String
    let hint: String?
    
    func body(content: Content) -> some View {
        content
            .accessibilityLabel(label)
            .accessibilityHint(hint ?? "")
    }
}

extension View {
    func accessibilityLabel(_ label: String, hint: String? = nil) -> some View {
        modifier(AccessibilityLabel(label: label, hint: hint))
    }
}

// MARK: - Haptic Feedback

struct HapticFeedback {
    static func impact(_ style: UIImpactFeedbackGenerator.FeedbackStyle = .medium) {
        let generator = UIImpactFeedbackGenerator(style: style)
        generator.impactOccurred()
    }
    
    static func notification(_ type: UINotificationFeedbackGenerator.FeedbackType) {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(type)
    }
    
    static func selection() {
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }
}

// MARK: - Animation Helpers

extension Animation {
    static let vancoSpring = Animation.spring(response: 0.5, dampingFraction: 0.8, blendDuration: 0)
    static let vancoEaseInOut = Animation.easeInOut(duration: 0.3)
}

// MARK: - Layout Helpers

struct AdaptiveStack<Content: View>: View {
    let horizontalAlignment: HorizontalAlignment
    let verticalAlignment: VerticalAlignment
    let spacing: CGFloat?
    let content: Content
    
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    
    init(
        horizontalAlignment: HorizontalAlignment = .center,
        verticalAlignment: VerticalAlignment = .center,
        spacing: CGFloat? = nil,
        @ViewBuilder content: () -> Content
    ) {
        self.horizontalAlignment = horizontalAlignment
        self.verticalAlignment = verticalAlignment
        self.spacing = spacing
        self.content = content()
    }
    
    var body: some View {
        Group {
            if horizontalSizeClass == .compact {
                VStack(alignment: horizontalAlignment, spacing: spacing) {
                    content
                }
            } else {
                HStack(alignment: verticalAlignment, spacing: spacing) {
                    content
                }
            }
        }
    }
}

// MARK: - Preview Helpers

#if DEBUG
extension Color {
    static let previewBackground = Color(.systemGray6)
}

struct PreviewContainer<Content: View>: View {
    let content: Content
    
    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }
    
    var body: some View {
        content
            .padding()
            .background(Color.previewBackground)
            .previewLayout(.sizeThatFits)
    }
}
#endif

// MARK: - Previews

#Preview("Button Styles") {
    VStack(spacing: 16) {
        Button("Primary Button") { }
            .buttonStyle(PrimaryButtonStyle())
        
        Button("Secondary Button") { }
            .buttonStyle(SecondaryButtonStyle())
        
        Button("Destructive Button") { }
            .buttonStyle(DestructiveButtonStyle())
        
        Button("Compact Button") { }
            .buttonStyle(CompactButtonStyle())
    }
    .padding()
}

#Preview("Info Cards") {
    VStack(spacing: 16) {
        InfoCard(
            title: "Information",
            message: "This is an informational message.",
            type: .info
        )
        
        InfoCard(
            title: "Warning",
            message: "This is a warning message that requires attention.",
            type: .warning
        )
        
        InfoCard(
            title: "Error",
            message: "This is an error message indicating a problem.",
            type: .error
        )
        
        InfoCard(
            title: "Success",
            message: "This is a success message confirming completion.",
            type: .success
        )
    }
    .padding()
}

#Preview("Progress Indicators") {
    VStack(spacing: 20) {
        ProgressBar(progress: 0.7)
        
        StepProgressView(
            currentStep: 1,
            totalSteps: 3,
            stepTitles: ["Setup", "Input", "Results"]
        )
    }
    .padding()
}

