import Capacitor

final class FinpillBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(FinpillClerkPlugin())
    }
}
