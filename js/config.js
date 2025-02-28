/**
 * Configuration settings for WebAudioSurf
 */
const CONFIG = {
    // Game settings
    game: {
        speed: 1.0,             // Base game speed
        sensitivity: 1.0,        // Control sensitivity
        difficulty: 'normal',    // 'easy', 'normal', 'hard'
        autoplay: false,         // Auto-steering
        laneCount: 3,            // Number of playable lanes
        blockFallSpeed: 0.5,     // Speed at which blocks fall onto the track
    },
    
    // Audio analysis settings
    audio: {
        fftSize: 2048,           // FFT size for audio analysis
        smoothingTimeConstant: 0.8,
        minDecibels: -70,
        maxDecibels: -30,
        frequencyBands: [
            { min: 20, max: 60 },      // Low bass
            { min: 60, max: 250 },     // Bass
            { min: 250, max: 500 },    // Low mids
            { min: 500, max: 2000 },   // Mids
            { min: 2000, max: 6000 },  // High mids
            { min: 6000, max: 20000 }, // Highs
        ]
    },
    
    // Track generation settings
    track: {
        segmentLength: 50,       // Length of track segments
        segmentWidth: 30,        // Width of the track
        visibleSegments: 30,     // Number of visible segments ahead
        curveIntensity: 0.8,     // How much the track curves
        hilliness: 0.6,          // How hilly the track is
    },
    
    // Visuals settings
    visuals: {
        fogDensity: 0.015,
        fogColor: 0x000030,
        backgroundColor: 0x000020,
        shipColor: 0x00aaff,
        blockColors: [
            0xff0000, // Red
            0x00ff00, // Green
            0x0000ff, // Blue
            0xffff00, // Yellow
            0xff00ff, // Magenta
            0x00ffff, // Cyan
        ],
        gridColor: 0x00aaff,
        bloomIntensity: 1.5,
        motionBlur: true,
        particleCount: 1000,
    },
    
    // Scoring system
    scoring: {
        basePoints: 50,
        comboMultiplier: 0.1,
        maxCombo: 10,
        perfectMatch: 200,
        colorMatch: 100,
        miss: -50,
    },
    
    // Mobile-specific settings
    mobile: {
        touchSensitivity: 1.5,
        vibrationEnabled: true,
        performanceMode: true,   // Reduce visual effects on mobile
    },
    
    // Keyboard configuration settings
    keyboard: {
        layouts: {
            arrows: {
                name: 'Arrow Keys',
                left: 'ArrowLeft',
                right: 'ArrowRight',
                up: 'ArrowUp',
                down: 'ArrowDown'
            },
            wasd: {
                name: 'WASD (QWERTY)',
                left: 'KeyA',
                right: 'KeyD',
                up: 'KeyW',
                down: 'KeyS'
            },
            zqsd: {
                name: 'ZQSD (AZERTY)',
                left: 'KeyQ',
                right: 'KeyD',
                up: 'KeyZ',
                down: 'KeyS'
            }
        },
        currentLayout: 'arrows' // Default to arrow keys
    }
};