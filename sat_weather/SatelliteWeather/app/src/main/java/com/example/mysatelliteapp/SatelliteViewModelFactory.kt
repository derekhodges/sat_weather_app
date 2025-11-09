package com.example.mysatelliteapp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import java.io.File

class SatelliteViewModelFactory(private val cacheDir: File) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(SatelliteViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return SatelliteViewModel(cacheDir) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
