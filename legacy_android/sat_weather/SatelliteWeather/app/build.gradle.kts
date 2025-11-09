plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.example.mysatelliteapp"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.example.mysatelliteapp"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = "11"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.activity:activity-compose:1.8.0")
    implementation("androidx.compose.ui:ui:1.6.0")
    implementation("androidx.compose.material3:material3:1.2.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.compose.material:material-icons-extended:1.6.0")

    // Use AWS SDK for Android instead of Java SDK
    implementation("com.amazonaws:aws-android-sdk-s3:2.60.0")

    // Use the NetCDF JAR directly, ensuring it takes precedence
    implementation(files("$rootDir/libs/netcdfAll-5.7.0.jar"))
}

// Add resolution strategy to force Guava version from netcdfAll-5.7.0.jar
configurations.all {
    resolutionStrategy {
        force("com.google.guava:guava:32.1.3-jre") // Use a version compatible with netcdfAll-5.7.0 (adjust if needed)
        force("com.google.guava:listenablefuture:9999.0-empty-to-avoid-conflict-with-guava") // Special version to avoid conflicts
    }
}