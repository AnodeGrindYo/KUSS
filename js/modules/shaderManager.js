/**
 * ShaderManager - Manages custom shaders for music visualization
 */
class ShaderManager {
    constructor(gameEngine) {
        this.gameEngine = gameEngine;
        this.scene = gameEngine.scene;
        this.camera = gameEngine.camera;
        this.renderer = gameEngine.renderer;
        this.audioProcessor = gameEngine.audioProcessor;
        
        this.customShaders = [];
        this.backgroundEffect = null;
        this.customPasses = [];
        this.isEnabled = !this.gameEngine.isMobileDevice();
    }

    /**
     * Initialize shaders and effects
     */
    init() {
        if (!this.isEnabled || !this.gameEngine.composer) return;
        
        try {
            // Create custom shader for audio-reactive effects
            this.createAudioReactiveShader();
            
            // Create warp effect
            this.createWarpEffect();
            
            // Add a background visualization plane
            this.createBackgroundVisualization();
        } catch (error) {
            console.warn("Shader initialization failed:", error);
            this.isEnabled = false;
        }
    }

    /**
     * Create audio-reactive shader
     */
    createAudioReactiveShader() {
        // Audio-reactive pass that enhances colors based on audio levels
        const audioReactiveShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "time": { value: 0.0 },
                "bassLevel": { value: 0.0 },
                "midLevel": { value: 0.0 },
                "highLevel": { value: 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float time;
                uniform float bassLevel;
                uniform float midLevel;
                uniform float highLevel;
                varying vec2 vUv;
                
                void main() {
                    vec2 uv = vUv;
                    
                    // Subtle distortion based on bass
                    uv.x += sin(uv.y * 10.0 + time * 0.5) * bassLevel * 0.01;
                    uv.y += cos(uv.x * 10.0 + time * 0.5) * bassLevel * 0.01;
                    
                    // Get base color
                    vec4 color = texture2D(tDiffuse, uv);
                    
                    // Enhance based on audio levels
                    color.r += bassLevel * 0.2 * color.r;
                    color.g += midLevel * 0.2 * color.g;
                    color.b += highLevel * 0.2 * color.b;
                    
                    // Glow effect based on high frequencies
                    color.rgb += color.rgb * highLevel * 0.3;
                    
                    gl_FragColor = color;
                }
            `
        };
        
        // Create shader pass
        const audioPass = new THREE.ShaderPass(audioReactiveShader);
        audioPass.renderToScreen = false;
        
        // Add to composer
        this.gameEngine.composer.addPass(audioPass);
        this.customPasses.push(audioPass);
    }

    /**
     * Create warp effect
     */
    createWarpEffect() {
        // Warp/speed effect that intensifies with tempo
        const warpShader = {
            uniforms: {
                "tDiffuse": { value: null },
                "time": { value: 0.0 },
                "beatIntensity": { value: 0.0 },
                "speed": { value: 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float time;
                uniform float beatIntensity;
                uniform float speed;
                varying vec2 vUv;
                
                void main() {
                    vec2 uv = vUv;
                    
                    // Center coordinates
                    vec2 center = vec2(0.5, 0.5);
                    vec2 centeredUv = uv - center;
                    
                    // Calculate distance from center
                    float dist = length(centeredUv);
                    
                    // Warp effect based on beat and speed
                    float warpFactor = beatIntensity * speed * 0.05;
                    vec2 warpedUv = uv + centeredUv * dist * warpFactor;
                    
                    // Add subtle pulsing
                    warpedUv += centeredUv * sin(time * 2.0) * beatIntensity * 0.02;
                    
                    // Sample with warped coordinates
                    vec4 color = texture2D(tDiffuse, warpedUv);
                    
                    // Add a slight color shift based on beat
                    if (beatIntensity > 0.6) {
                        color.rgb += vec3(0.0, 0.0, beatIntensity * 0.2);
                    }
                    
                    gl_FragColor = color;
                }
            `
        };
        
        // Create shader pass
        const warpPass = new THREE.ShaderPass(warpShader);
        warpPass.renderToScreen = true;
        
        // Add to composer
        this.gameEngine.composer.addPass(warpPass);
        this.customPasses.push(warpPass);
    }

    /**
     * Create background visualization
     */
    createBackgroundVisualization() {
        // Create a shader for background visualization
        const visualizationShader = {
            uniforms: {
                "time": { value: 0.0 },
                "bassLevel": { value: 0.0 },
                "midLevel": { value: 0.0 },
                "highLevel": { value: 0.0 },
                "resolution": { value: new THREE.Vector2() }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float bassLevel;
                uniform float midLevel;
                uniform float highLevel;
                uniform vec2 resolution;
                varying vec2 vUv;
                
                // Noise function
                float noise(vec2 p) {
                    return sin(p.x * 10.0) * sin(p.y * 10.0) * 0.5 + 0.5;
                }
                
                void main() {
                    vec2 uv = vUv;
                    vec2 center = vec2(0.5, 0.5);
                    float aspect = resolution.x / resolution.y;
                    
                    // Adjust for aspect ratio
                    uv.x *= aspect;
                    
                    // Create circular waves based on audio
                    float dist = distance(uv, vec2(center.x * aspect, center.y));
                    float wave = sin(dist * 20.0 - time * 2.0) * 0.5 + 0.5;
                    
                    // Create color based on audio levels
                    vec3 color = vec3(0.0);
                    
                    // Bass pulses (red)
                    color.r = smoothstep(0.4, 0.6, wave) * bassLevel;
                    
                    // Mid frequencies (green)
                    color.g = smoothstep(0.5, 0.7, 1.0 - wave) * midLevel;
                    
                    // High frequencies (blue)
                    color.b = (noise(uv * 5.0 + time * 0.1) * highLevel) * 0.8;
                    
                    // Add some glow
                    color += vec3(0.0, 0.05, 0.1) * (1.0 - dist);
                    
                    // Fade out towards edges
                    color *= smoothstep(1.5, 0.5, dist);
                    
                    gl_FragColor = vec4(color, 0.6); // Semi-transparent
                }
            `
        };
        
        // Create a plane for the background
        const plane = new THREE.PlaneGeometry(200, 200);
        const material = new THREE.ShaderMaterial({
            uniforms: visualizationShader.uniforms,
            vertexShader: visualizationShader.vertexShader,
            fragmentShader: visualizationShader.fragmentShader,
            transparent: true,
            depthWrite: false
        });
        
        // Set resolution
        visualizationShader.uniforms.resolution.value.set(
            window.innerWidth * window.devicePixelRatio,
            window.innerHeight * window.devicePixelRatio
        );
        
        // Create mesh
        const mesh = new THREE.Mesh(plane, material);
        mesh.position.z = -50; // Behind everything
        mesh.rotation.x = Math.PI / 2; // Face the camera
        
        // Add to scene
        this.scene.add(mesh);
        this.backgroundEffect = mesh;
    }

    /**
     * Update shader uniforms based on audio analysis
     */
    update() {
        if (!this.isEnabled || !this.audioProcessor || !this.audioProcessor.isAnalysisDone) return;
        
        // Get current audio analysis
        const analysis = this.audioProcessor.updateAnalysis();
        if (!analysis) return;
        
        // Current time
        const time = this.gameEngine.clock.getElapsedTime();
        
        // Update audio shader pass
        this.customPasses.forEach(pass => {
            if (pass.uniforms.time) {
                pass.uniforms.time.value = time;
            }
            
            if (pass.uniforms.beatIntensity) {
                pass.uniforms.beatIntensity.value = analysis.beatIntensity;
            }
            
            if (pass.uniforms.speed) {
                pass.uniforms.speed.value = this.gameEngine.playerSpeed;
            }
            
            if (pass.uniforms.bassLevel) {
                pass.uniforms.bassLevel.value = analysis.bandEnergies[0];
            }
            
            if (pass.uniforms.midLevel) {
                pass.uniforms.midLevel.value = 
                    (analysis.bandEnergies[2] + analysis.bandEnergies[3]) / 2;
            }
            
            if (pass.uniforms.highLevel) {
                pass.uniforms.highLevel.value = analysis.bandEnergies[5];
            }
        });
        
        // Update background visualization
        if (this.backgroundEffect) {
            const material = this.backgroundEffect.material;
            
            if (material.uniforms.time) {
                material.uniforms.time.value = time;
            }
            
            if (material.uniforms.bassLevel) {
                material.uniforms.bassLevel.value = analysis.bandEnergies[0];
            }
            
            if (material.uniforms.midLevel) {
                material.uniforms.midLevel.value = 
                    (analysis.bandEnergies[2] + analysis.bandEnergies[3]) / 2;
            }
            
            if (material.uniforms.highLevel) {
                material.uniforms.highLevel.value = analysis.bandEnergies[5];
            }
        }
    }

    /**
     * Handle window resize
     */
    handleResize() {
        if (this.backgroundEffect && this.backgroundEffect.material.uniforms.resolution) {
            this.backgroundEffect.material.uniforms.resolution.value.set(
                window.innerWidth * window.devicePixelRatio,
                window.innerHeight * window.devicePixelRatio
            );
        }
    }

    /**
     * Dispose resources
     */
    dispose() {
        if (this.backgroundEffect) {
            this.backgroundEffect.material.dispose();
            this.backgroundEffect.geometry.dispose();
            this.scene.remove(this.backgroundEffect);
        }
        
        this.customPasses = [];
        this.customShaders = [];
    }
}