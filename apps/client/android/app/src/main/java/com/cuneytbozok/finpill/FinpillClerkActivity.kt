package com.cuneytbozok.finpill

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.clerk.ui.auth.AuthMode
import com.clerk.ui.auth.AuthView

/** Clerk owns the authentication UI and its secure native session state. */
class FinpillClerkActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AuthView(
                mode = AuthMode.SignIn,
                onDismiss = { finish() },
                onAuthComplete = { finish() },
            )
        }
    }
}
