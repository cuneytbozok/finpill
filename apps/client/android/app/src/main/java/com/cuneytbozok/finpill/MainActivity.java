package com.cuneytbozok.finpill;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(FinpillClerkPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
