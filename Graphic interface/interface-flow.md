# Interface Flow

This document describes the expected user interaction for the first desktop prototype of the application.

The interface is designed to be simple, visual, and easy to use.  
The user begins by opening the application and choosing between recording a sound or uploading an existing audio file.  
After the audio is received, the system processes it, shows a loading stage, and then displays several recommended sounds retrieved from Freesound.  
The user can listen to real Freesound previews, compare results, and open the original sound page on Freesound.

## User Flow Diagram

```mermaid
flowchart TD
    A[User opens the desktop application] --> B{Choose input method}
    B --> C[Record a sound]
    B --> D[Upload an audio file]

    C --> E[Audio input received]
    D --> E

    E --> F[Process and analyze the audio]
    F --> G[Loading screen]
    G --> H[Search similar sounds through Freesound API]

    H --> I[Display recommended results]

    I --> J[Play and compare samples]
    J --> K{Satisfied with a result?}

    K -->|Yes| L[Open selected sound on Freesound]
    K -->|No| M[Try another recommendation]
    M --> J

    L --> N[End]
```
