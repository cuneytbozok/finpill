import Capacitor
import ClerkKit
import ClerkKitUI
import SwiftUI
import UIKit

@objc(FinpillClerkPlugin)
public final class FinpillClerkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FinpillClerkPlugin"
    public let jsName = "FinpillClerk"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "state", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise),
    ]

    private var configuredKey: String?

    @objc func initialize(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let key = call.getString("publishableKey"),
                  key.hasPrefix("pk_test_") || key.hasPrefix("pk_live_") else {
                call.reject("A Clerk publishable key is required")
                return
            }
            if let configuredKey, configuredKey != key {
                call.reject("Clerk is already configured for another instance")
                return
            }
            if configuredKey == nil {
                Clerk.configure(publishableKey: key)
                configuredKey = key
            }
            call.resolve(currentState())
        }
    }

    @objc func state(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard configuredKey != nil else {
                call.reject("Clerk is not configured")
                return
            }
            call.resolve(currentState())
        }
    }

    @objc func signIn(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard configuredKey != nil else {
                call.reject("Clerk is not configured")
                return
            }
            guard Clerk.shared.user == nil else {
                call.resolve(currentState())
                return
            }
            guard let presenter = bridge?.viewController,
                  presenter.presentedViewController == nil else {
                call.reject("Authentication screen is unavailable")
                return
            }
            let controller = UIHostingController(
                rootView: AuthView(mode: .signIn).environment(Clerk.shared)
            )
            presenter.present(controller, animated: true) {
                call.resolve()
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard configuredKey != nil else {
                call.reject("Clerk is not configured")
                return
            }
            do {
                try await Clerk.shared.auth.signOut()
                call.resolve(currentState())
            } catch {
                call.reject("Clerk sign-out failed")
            }
        }
    }

    @objc func getToken(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard configuredKey != nil else {
                call.reject("Clerk is not configured")
                return
            }
            do {
                let token = try await Clerk.shared.session?.getToken()
                call.resolve(["token": token as Any? ?? NSNull()])
            } catch {
                call.reject("Clerk token refresh failed")
            }
        }
    }

    @MainActor
    private func currentState() -> [String: Any] {
        [
            "isLoaded": Clerk.shared.isLoaded,
            "userId": Clerk.shared.user?.id as Any? ?? NSNull(),
        ]
    }
}
