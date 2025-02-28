/**
 * TrackGenerator - Creates the 3D track based on audio analysis
 */
class TrackGenerator {
    constructor(scene, audioProcessor) {
        this.scene = scene;
        this.audioProcessor = audioProcessor;
        this.trackMesh = null;
        this.trackGeometry = null;
        this.trackMaterial = null;
        this.trackSegments = [];
        this.trackObjects = [];
        this.blocks = [];
        this.lanes = CONFIG.game.laneCount;
        this.segmentLength = CONFIG.track.segmentLength;
        this.trackWidth = CONFIG.track.segmentWidth;
        this.visibleSegments = CONFIG.track.visibleSegments;
        this.curveIntensity = CONFIG.track.curveIntensity;
        this.hilliness = CONFIG.track.hilliness;
        this.currentSegment = 0;
        this.trackPath = [];
    }

    /**
     * Generate the complete track from audio analysis
     * @param {Array} analysisResults - Audio analysis data
     */
    generateTrack(analysisResults) {
        // Clear existing track
        this.clearTrack();
        
        // Generate track path points
        this.generateTrackPath(analysisResults);
        
        // Create track segments
        this.createTrackMesh();
        
        // Generate objects on the track
        this.generateTrackObjects(analysisResults);
        
        return {
            totalSegments: this.trackSegments.length,
            totalBlocks: this.blocks.length,
            trackLength: this.trackSegments.length * this.segmentLength
        };
    }

    /**
     * Generate track path points based on audio analysis
     * @param {Array} analysisResults - Audio analysis data
     */
    generateTrackPath(analysisResults) {
        this.trackPath = [];
        this.trackSegments = [];
        
        // Parameters for track generation
        const pointsPerSegment = 4; // Cubic curve resolution
        const totalPoints = analysisResults.length * pointsPerSegment;
        
        // Generate initial straight section
        for (let i = 0; i < 10; i++) {
            this.trackPath.push({
                position: new THREE.Vector3(0, 0, -i * this.segmentLength / pointsPerSegment),
                rotation: 0,
                tilt: 0
            });
        }
        
        // Variables for track curvature
        let currentDirection = 0;
        let currentTilt = 0;
        let targetDirection = 0;
        let targetTilt = 0;
        let currentElevation = 0;
        let targetElevation = 0;
        
        // Generate track path based on audio analysis
        for (let i = 0; i < analysisResults.length; i++) {
            const analysis = analysisResults[i];
            
            // Determine track direction changes based on audio
            // More intense beats create curves, frequency bands affect direction
            if (analysis.beatIntensity > 0.7) {
                // Determine curve direction based on dominant frequencies
                const directionInfluence = analysis.bandEnergies[1] - analysis.bandEnergies[4];
                targetDirection = directionInfluence * this.curveIntensity * 0.5;
            } else {
                // Gradually return to straight path
                targetDirection *= 0.95;
            }
            
            // Generate tilt based on mid-frequencies
            if (analysis.bandEnergies[2] > 0.7 || analysis.bandEnergies[3] > 0.7) {
                targetTilt = (analysis.bandEnergies[2] - analysis.bandEnergies[3]) * this.hilliness;
            } else {
                // Gradually level out
                targetTilt *= 0.95;
            }
            
            // Generate elevation based on time domain data (waveform)
            if (analysis.timeData) {
                // Calculate average amplitude from time domain data
                let sum = 0;
                for (let j = 0; j < analysis.timeData.length; j++) {
                    // Convert from 0-255 to -128-127 range
                    const amplitude = analysis.timeData[j] - 128;
                    sum += Math.abs(amplitude);
                }
                const avgAmplitude = sum / analysis.timeData.length;
                
                // Map to elevation change
                targetElevation = (avgAmplitude / 128) * this.hilliness * 10 - 5;
            }
            
            // Smooth changes
            currentDirection = currentDirection * 0.9 + targetDirection * 0.1;
            currentTilt = currentTilt * 0.9 + targetTilt * 0.1;
            currentElevation = currentElevation * 0.95 + targetElevation * 0.05;
            
            // Create path point
            const lastPoint = this.trackPath[this.trackPath.length - 1];
            const newDirection = lastPoint.rotation + currentDirection;
            
            // Calculate new position
            const newX = lastPoint.position.x + Math.sin(newDirection) * this.segmentLength / pointsPerSegment;
            const newZ = lastPoint.position.z - Math.cos(newDirection) * this.segmentLength / pointsPerSegment;
            const newY = lastPoint.position.y + currentElevation;
            
            // Add point to path
            this.trackPath.push({
                position: new THREE.Vector3(newX, newY, newZ),
                rotation: newDirection,
                tilt: currentTilt
            });
            
            // Create a new segment every few points
            if (i % pointsPerSegment === 0) {
                this.trackSegments.push({
                    startPathIndex: this.trackPath.length - pointsPerSegment,
                    endPathIndex: this.trackPath.length - 1,
                    audioIndex: i,
                    beatIntensity: analysis.beatIntensity,
                    bandEnergies: analysis.bandEnergies
                });
            }
        }
    }

    /**
     * Create the physical track mesh
     */
    createTrackMesh() {
        // Create track geometry
        this.trackGeometry = new THREE.BufferGeometry();
        
        // Calculate vertices, normals, and UVs
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        
        // Create track surface for each segment
        for (let i = 0; i < this.trackSegments.length; i++) {
            const segment = this.trackSegments[i];
            const startPoint = this.trackPath[segment.startPathIndex];
            const endPoint = this.trackPath[segment.endPathIndex];
            
            // Calculate segment direction vector
            const direction = new THREE.Vector3()
                .subVectors(endPoint.position, startPoint.position)
                .normalize();
            
            // Calculate surface normal (up vector)
            const normal = new THREE.Vector3(0, 1, 0);
            
            // Calculate right vector
            const right = new THREE.Vector3()
                .crossVectors(direction, normal)
                .normalize()
                .multiplyScalar(this.trackWidth / 2);
            
            // Create segment vertices
            const startLeft = new THREE.Vector3().subVectors(startPoint.position, right);
            const startRight = new THREE.Vector3().addVectors(startPoint.position, right);
            const endLeft = new THREE.Vector3().subVectors(endPoint.position, right);
            const endRight = new THREE.Vector3().addVectors(endPoint.position, right);
            
            // Add vertices for this segment
            const baseIndex = vertices.length / 3;
            
            // Add vertices
            vertices.push(
                startLeft.x, startLeft.y, startLeft.z,
                startRight.x, startRight.y, startRight.z,
                endLeft.x, endLeft.y, endLeft.z,
                endRight.x, endRight.y, endRight.z
            );
            
            // Add normals (all pointing up)
            for (let j = 0; j < 4; j++) {
                normals.push(0, 1, 0);
            }
            
            // Add UVs based on track position
            const segmentU = i / this.trackSegments.length;
            uvs.push(
                0, segmentU,
                1, segmentU,
                0, segmentU + 1/this.trackSegments.length,
                1, segmentU + 1/this.trackSegments.length
            );
            
            // Add indices for triangles
            indices.push(
                baseIndex, baseIndex + 1, baseIndex + 2,
                baseIndex + 1, baseIndex + 3, baseIndex + 2
            );
            
            // Add lane dividers
            if (this.lanes > 1) {
                const laneWidth = this.trackWidth / this.lanes;
                
                for (let lane = 1; lane < this.lanes; lane++) {
                    const laneOffset = -this.trackWidth/2 + lane * laneWidth;
                    const laneVector = new THREE.Vector3(right.x, right.y, right.z)
                        .normalize()
                        .multiplyScalar(laneOffset);
                    
                    const startLane = new THREE.Vector3().addVectors(startPoint.position, laneVector);
                    const endLane = new THREE.Vector3().addVectors(endPoint.position, laneVector);
                    
                    // Add lane marker later (in separate method)
                }
            }
        }
        
        // Set geometry attributes
        this.trackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.trackGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        this.trackGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        this.trackGeometry.setIndex(indices);
        
        // Create track material
        this.trackMaterial = new THREE.MeshStandardMaterial({
            color: 0x333366,
            metalness: 0.4,
            roughness: 0.6,
            side: THREE.DoubleSide,
            flatShading: false
        });
        
        // Create the track mesh
        this.trackMesh = new THREE.Mesh(this.trackGeometry, this.trackMaterial);
        this.scene.add(this.trackMesh);
        
        // Add grid lines
        this.addTrackGrid();
    }

    /**
     * Add grid lines to the track
     */
    addTrackGrid() {
        const gridGeometry = new THREE.BufferGeometry();
        const gridMaterial = new THREE.LineBasicMaterial({ 
            color: CONFIG.visuals.gridColor,
            transparent: true,
            opacity: 0.5
        });
        
        const gridVertices = [];
        
        // Add cross lines every few segments
        const gridInterval = 5;
        
        for (let i = 0; i < this.trackSegments.length; i += gridInterval) {
            if (i >= this.trackSegments.length) break;
            
            const segment = this.trackSegments[i];
            const point = this.trackPath[segment.startPathIndex];
            
            // Calculate segment direction vector
            const forward = new THREE.Vector3();
            if (i + gridInterval < this.trackSegments.length) {
                const nextSegment = this.trackSegments[i + gridInterval];
                const nextPoint = this.trackPath[nextSegment.startPathIndex];
                forward.subVectors(nextPoint.position, point.position).normalize();
            } else {
                // Use previous direction for last segment
                const prevSegment = this.trackSegments[i - gridInterval];
                const prevPoint = this.trackPath[prevSegment.startPathIndex];
                forward.subVectors(point.position, prevPoint.position).normalize();
            }
            
            // Calculate right vector
            const right = new THREE.Vector3(0, 1, 0).cross(forward).normalize().multiplyScalar(this.trackWidth / 2);
            
            // Add cross line
            const startLeft = new THREE.Vector3().subVectors(point.position, right);
            const startRight = new THREE.Vector3().addVectors(point.position, right);
            
            gridVertices.push(
                startLeft.x, startLeft.y + 0.1, startLeft.z,
                startRight.x, startRight.y + 0.1, startRight.z
            );
        }
        
        // Add side lines
        const sideInterval = 5;
        for (let side = -1; side <= 1; side += 2) {
            const sideOffset = side * this.trackWidth / 2;
            
            for (let i = 0; i < this.trackPath.length; i += sideInterval) {
                if (i + sideInterval >= this.trackPath.length) break;
                
                const point = this.trackPath[i];
                const nextPoint = this.trackPath[i + sideInterval];
                
                // Calculate direction vector
                const direction = new THREE.Vector3().subVectors(nextPoint.position, point.position).normalize();
                
                // Calculate right vector
                const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize().multiplyScalar(sideOffset);
                
                // Add line points
                const start = new THREE.Vector3().addVectors(point.position, right);
                const end = new THREE.Vector3().addVectors(nextPoint.position, right);
                
                gridVertices.push(
                    start.x, start.y + 0.1, start.z,
                    end.x, end.y + 0.1, end.z
                );
            }
        }
        
        // Add lane dividers
        if (this.lanes > 1) {
            const laneWidth = this.trackWidth / this.lanes;
            
            for (let lane = 1; lane < this.lanes; lane++) {
                const laneOffset = -this.trackWidth/2 + lane * laneWidth;
                
                for (let i = 0; i < this.trackPath.length; i += sideInterval) {
                    if (i + sideInterval >= this.trackPath.length) break;
                    
                    const point = this.trackPath[i];
                    const nextPoint = this.trackPath[i + sideInterval];
                    
                    // Calculate direction vector
                    const direction = new THREE.Vector3().subVectors(nextPoint.position, point.position).normalize();
                    
                    // Calculate lane position vector
                    const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize().multiplyScalar(laneOffset);
                    
                    // Add line points
                    const start = new THREE.Vector3().addVectors(point.position, right);
                    const end = new THREE.Vector3().addVectors(nextPoint.position, right);
                    
                    gridVertices.push(
                        start.x, start.y + 0.1, start.z,
                        end.x, end.y + 0.1, end.z
                    );
                }
            }
        }
        
        // Set geometry attributes
        gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridVertices, 3));
        
        // Create and add grid mesh
        const gridMesh = new THREE.LineSegments(gridGeometry, gridMaterial);
        this.scene.add(gridMesh);
        this.trackObjects.push(gridMesh);
    }

    /**
     * Generate objects on the track based on audio analysis
     * @param {Array} analysisResults - Audio analysis data
     */
    generateTrackObjects(analysisResults) {
        this.blocks = [];
        
        // Loop through analysis results to place blocks
        for (let i = 0; i < analysisResults.length; i++) {
            const analysis = analysisResults[i];
            
            // Only create a block if the beat is significant
            if (analysis.isBlock) {
                // Determine which segment this block belongs to
                const segmentIndex = Math.floor(i / 4); // Assuming 4 analysis points per segment
                if (segmentIndex >= this.trackSegments.length) continue;
                
                const segment = this.trackSegments[segmentIndex];
                const pathPoint = this.trackPath[segment.startPathIndex];
                
                // Determine which lane to place the block in based on audio
                // Use frequency distribution to determine lane
                const laneIndex = this.determineLane(analysis.bandEnergies);
                
                // Calculate lane position
                const laneWidth = this.trackWidth / this.lanes;
                const laneOffset = -this.trackWidth/2 + (laneIndex + 0.5) * laneWidth;
                
                // Calculate direction
                const forward = new THREE.Vector3();
                if (segment.startPathIndex + 1 < this.trackPath.length) {
                    const nextPoint = this.trackPath[segment.startPathIndex + 1];
                    forward.subVectors(nextPoint.position, pathPoint.position).normalize();
                } else {
                    forward.set(0, 0, -1); // Default forward
                }
                
                // Calculate right vector
                const right = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
                
                // Calculate block position
                const blockPosition = new THREE.Vector3().copy(pathPoint.position)
                    .add(right.clone().multiplyScalar(laneOffset))
                    .add(new THREE.Vector3(0, 1.5, 0)); // Float above the track
                
                // Determine block color from analysis
                const colorIndex = analysis.blockColor;
                const blockColor = CONFIG.visuals.blockColors[colorIndex];
                
                // Create the block
                this.createBlock(blockPosition, laneIndex, blockColor, segmentIndex, analysis.beatIntensity);
            }
        }
    }

    /**
     * Create a block object on the track
     * @param {THREE.Vector3} position - Block position
     * @param {number} laneIndex - Lane index (0 to lanes-1)
     * @param {number} color - Block color as hex value
     * @param {number} segmentIndex - Track segment index
     * @param {number} intensity - Beat intensity (affects block size)
     */
    createBlock(position, laneIndex, color, segmentIndex, intensity) {
        // Calculate block size based on lane width
        const laneWidth = this.trackWidth / this.lanes;
        const blockWidth = laneWidth * 0.8;
        const blockHeight = 1.5 * intensity; // Height based on beat intensity
        const blockDepth = this.segmentLength * 0.3;
        
        // Create block geometry
        const geometry = new THREE.BoxGeometry(blockWidth, blockHeight, blockDepth);
        
        // Create material with glow effect
        const material = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.5,
            metalness: 0.7,
            roughness: 0.3,
            transparent: true,
            opacity: 0.9
        });
        
        // Create mesh
        const blockMesh = new THREE.Mesh(geometry, material);
        blockMesh.position.copy(position);
        blockMesh.castShadow = true;
        blockMesh.receiveShadow = true;
        
        // Add to scene
        this.scene.add(blockMesh);
        
        // Store block data
        this.blocks.push({
            mesh: blockMesh,
            laneIndex: laneIndex,
            segmentIndex: segmentIndex,
            color: color,
            collected: false,
            visible: true
        });
        
        // Add to track objects list for cleanup
        this.trackObjects.push(blockMesh);
        
        return blockMesh;
    }

    /**
     * Determine which lane to place a block based on frequency analysis
     * @param {Array} bandEnergies - Energy in each frequency band
     * @returns {number} - Lane index (0 to lanes-1)
     */
    determineLane(bandEnergies) {
        // Simple approach: use relative energy of bands to pick a lane
        const totalEnergy = bandEnergies.reduce((sum, energy) => sum + energy, 0);
        let cumulativeEnergy = 0;
        
        // Choose random lane weighted by frequency distribution
        const randomValue = Math.random() * totalEnergy;
        
        for (let i = 0; i < bandEnergies.length; i++) {
            cumulativeEnergy += bandEnergies[i];
            if (randomValue <= cumulativeEnergy) {
                // Map band index to lane index
                return i % this.lanes;
            }
        }
        
        // Fallback to random lane
        return Math.floor(Math.random() * this.lanes);
    }

    /**
     * Update track based on player position
     * @param {number} playerSegment - Current player segment index
     */
    updateTrack(playerSegment) {
        // Check visible segments ahead
        const farSegment = playerSegment + this.visibleSegments;
        
        // Update block visibility based on current segment
        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];
            
            // Make blocks visible if they're within the visible range
            if (block.segmentIndex >= playerSegment - 5 && block.segmentIndex <= farSegment) {
                if (block.mesh && !block.visible) {
                    block.mesh.visible = true;
                    block.visible = true;
                }
            } else {
                if (block.mesh && block.visible) {
                    block.mesh.visible = false;
                    block.visible = false;
                }
            }
        }
    }

    /**
     * Get position on track for a given segment and lane
     * @param {number} segmentIndex - Segment index
     * @param {number} laneIndex - Lane index (0 to lanes-1)
     * @param {number} offset - Offset within segment (0-1)
     * @returns {THREE.Vector3} - Position on track
     */
    getPositionOnTrack(segmentIndex, laneIndex, offset = 0) {
        if (segmentIndex < 0 || segmentIndex >= this.trackSegments.length) {
            return new THREE.Vector3(0, 0, 0);
        }
        
        const segment = this.trackSegments[segmentIndex];
        const pointIndex = segment.startPathIndex + Math.floor(offset * (segment.endPathIndex - segment.startPathIndex));
        const point = this.trackPath[pointIndex];
        
        // Calculate lane position
        const laneWidth = this.trackWidth / this.lanes;
        const laneOffset = -this.trackWidth/2 + (laneIndex + 0.5) * laneWidth;
        
        // Calculate direction vectors
        let forward = new THREE.Vector3();
        if (pointIndex + 1 < this.trackPath.length) {
            const nextPoint = this.trackPath[pointIndex + 1];
            forward.subVectors(nextPoint.position, point.position).normalize();
        } else {
            forward.set(0, 0, -1); // Default forward
        }
        
        // Calculate right vector
        const right = new THREE.Vector3(0, 1, 0).cross(forward).normalize();
        
        // Calculate position on track
        const position = new THREE.Vector3().copy(point.position)
            .add(right.clone().multiplyScalar(laneOffset))
            .add(new THREE.Vector3(0, 0.5, 0)); // Slight lift above track
            
        return position;
    }

    /**
     * Get the direction (forward vector) at a given segment
     * @param {number} segmentIndex - Segment index
     * @param {number} offset - Offset within segment (0-1)
     * @returns {THREE.Vector3} - Direction vector
     */
    getDirectionAtSegment(segmentIndex, offset = 0) {
        if (segmentIndex < 0 || segmentIndex >= this.trackSegments.length) {
            return new THREE.Vector3(0, 0, -1); // Default forward
        }
        
        const segment = this.trackSegments[segmentIndex];
        const pointIndex = segment.startPathIndex + Math.floor(offset * (segment.endPathIndex - segment.startPathIndex));
        
        if (pointIndex + 1 >= this.trackPath.length) {
            return new THREE.Vector3(0, 0, -1); // Default forward
        }
        
        const point = this.trackPath[pointIndex];
        const nextPoint = this.trackPath[pointIndex + 1];
        
        // Calculate and return direction
        return new THREE.Vector3().subVectors(nextPoint.position, point.position).normalize();
    }

    /**
     * Check for block collisions
     * @param {number} playerSegment - Current player segment
     * @param {number} playerLane - Current player lane
     * @returns {Object|null} - Collided block data or null
     */
    checkBlockCollision(playerSegment, playerLane) {
        for (let i = 0; i < this.blocks.length; i++) {
            const block = this.blocks[i];
            
            // Skip already collected blocks
            if (block.collected) continue;
            
            // Check if block is in range of player
            if (Math.abs(block.segmentIndex - playerSegment) <= 1 && block.laneIndex === playerLane) {
                // Mark as collected
                block.collected = true;
                
                // Hide the block
                if (block.mesh) {
                    block.mesh.visible = false;
                }
                
                // Return block data
                return {
                    index: i,
                    color: block.color,
                    segmentIndex: block.segmentIndex
                };
            }
        }
        
        return null;
    }

    /**
     * Get total track length in segments
     * @returns {number} - Track length in segments
     */
    getTrackLength() {
        return this.trackSegments.length;
    }

    /**
     * Clear the track and associated objects
     */
    clearTrack() {
        // Remove all track objects
        for (let i = 0; i < this.trackObjects.length; i++) {
            const object = this.trackObjects[i];
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    for (let j = 0; j < object.material.length; j++) {
                        object.material[j].dispose();
                    }
                } else {
                    object.material.dispose();
                }
            }
            this.scene.remove(object);
        }
        
        // Clear track mesh
        if (this.trackMesh) {
            if (this.trackGeometry) this.trackGeometry.dispose();
            if (this.trackMaterial) this.trackMaterial.dispose();
            this.scene.remove(this.trackMesh);
            this.trackMesh = null;
        }
        
        // Reset arrays
        this.trackObjects = [];
        this.blocks = [];
        this.trackSegments = [];
        this.trackPath = [];
    }
}