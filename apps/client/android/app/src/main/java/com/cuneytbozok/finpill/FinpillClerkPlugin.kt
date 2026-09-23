package com.cuneytbozok.finpill

import android.content.Intent
import com.clerk.api.Clerk
import com.clerk.api.network.serialization.ClerkResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

@CapacitorPlugin(name = "FinpillClerk")
class FinpillClerkPlugin : Plugin() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var configuredKey: String? = null

    @PluginMethod
    fun initialize(call: PluginCall) {
        val key = call.getString("publishableKey")
        if (key == null || !(key.startsWith("pk_test_") || key.startsWith("pk_live_"))) {
            call.reject("A Clerk publishable key is required")
            return
        }
        if (configuredKey != null && configuredKey != key) {
            call.reject("Clerk is already configured for another instance")
            return
        }
        try {
            if (configuredKey == null) {
                Clerk.initialize(context.applicationContext, key)
                configuredKey = key
            }
            call.resolve(currentState())
        } catch (_: Exception) {
            call.reject("Clerk initialization failed")
        }
    }

    @PluginMethod
    fun state(call: PluginCall) {
        if (!requireConfigured(call)) return
        call.resolve(currentState())
    }

    @PluginMethod
    fun signIn(call: PluginCall) {
        if (!requireConfigured(call)) return
        if (!Clerk.isInitialized.value) {
            call.reject("Clerk is not ready")
            return
        }
        if (Clerk.user != null) {
            call.resolve(currentState())
            return
        }
        activity.startActivity(Intent(activity, FinpillClerkActivity::class.java))
        call.resolve()
    }

    @PluginMethod
    fun signOut(call: PluginCall) {
        if (!requireConfigured(call)) return
        scope.launch {
            try {
                when (Clerk.auth.signOut()) {
                    is ClerkResult.Success -> call.resolve(currentState())
                    is ClerkResult.Failure -> call.reject("Clerk sign-out failed")
                }
            } catch (_: Exception) {
                call.reject("Clerk sign-out failed")
            }
        }
    }

    @PluginMethod
    fun getToken(call: PluginCall) {
        if (!requireConfigured(call)) return
        if (!Clerk.isInitialized.value) {
            call.reject("Clerk is not ready")
            return
        }
        if (Clerk.user == null) {
            call.resolve(JSObject().put("token", null))
            return
        }
        scope.launch {
            try {
                when (val result = Clerk.auth.getToken()) {
                    is ClerkResult.Success -> call.resolve(JSObject().put("token", result.value))
                    is ClerkResult.Failure -> call.reject("Clerk token refresh failed")
                }
            } catch (_: Exception) {
                call.reject("Clerk token refresh failed")
            }
        }
    }

    private fun requireConfigured(call: PluginCall): Boolean {
        if (configuredKey != null) return true
        call.reject("Clerk is not configured")
        return false
    }

    private fun currentState() = JSObject()
        .put("isLoaded", Clerk.isInitialized.value)
        .put("userId", Clerk.user?.id)
}
