import * as CANNON from "cannon";
import * as THREE from "three";
import { PhysObject } from "./phys-object";

export enum SoftType {
    MASS_SPRING,
    PRESSURE,
    HYBRID
}

export interface SoftOptions {
    type?: SoftType;
    pressure?: number;
    stiffness?: number;
    damping?: number;
    point_mass?: number;
    point_radius?: number;
    point_damping?: number;
    color?: number;
}

export class SoftObject implements PhysObject, SoftOptions {

    mesh: THREE.Mesh;
    shape: CANNON.Trimesh;
    bodies: CANNON.Body[];
    springs: CANNON.Spring[];

    type: SoftType = SoftType.PRESSURE;

    pressure: number;
    stiffness: number;
    damping: number;

    point_mass: number;
    point_radius: number;
    point_damping: number;
    
    debug_meshes: THREE.Mesh[];
    debug_lines: THREE.LineSegments;

    color: number;

    /**
     * Read geometry to a new physics object.
     * @param vertices array of CANNON.Vec3 vertices
     * @param faces array of arrays of vertex indices
     * @param options options object
     */
    constructor(vertices: number[], faces: number[][], options?: SoftOptions) {

        this.type = options?.type ?? SoftType.PRESSURE;

        // spring options
        this.pressure = this.type === SoftType.MASS_SPRING ? 0 : options?.pressure ?? 50;
        this.stiffness = options?.stiffness ?? 200;
        this.damping = options?.damping ?? 0.4;

        // point options
        this.point_mass = options?.point_mass ?? 0.05;
        this.point_radius = options?.point_radius ?? 0.01;
        this.point_damping = options?.point_damping ?? 0.3;

        // misc options
        this.color = options?.color ?? 0xff0000;

        const indices_tri = [];

        // triangulate
        faces.forEach(face => {
            if (face.length === 3) {
                indices_tri.push(...face);
            } else if (face.length === 4) {
                indices_tri.push(face[0], face[1], face[2]);
                indices_tri.push(face[2], face[3], face[0]);
            }
        });

        this.shape = new CANNON.Trimesh(vertices, indices_tri);
        this.bodies = [];
        this.debug_meshes = [];

        // for each vertex
        for (let i = 0; i < vertices.length; i+= 3) {
            
            const x = vertices[i];
            const y = vertices[i+1];
            const z = vertices[i+2];

            const body = new CANNON.Body({ mass: this.point_mass });
            body.addShape(new CANNON.Sphere(this.point_radius));
            body.position.set(x, y, z);
            body.linearDamping = this.point_damping; // air resistance
            this.bodies.push(body);

            // debug meshes
            const geom = new THREE.SphereGeometry(this.point_radius);
            const mat = new THREE.MeshPhongMaterial({ color: this.color, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geom, mat);
            mesh.position.set(x, y, z);
            this.debug_meshes.push(mesh);

        }

        this.springs = [];
        const debug_line_points = [];

        // keep track of vertex pairs that have been added
        const added = new Map<number, number[]>();

        // add spring between each vertex
        faces.forEach(face => {

            let pairs: number[][];

            if (this.type === SoftType.PRESSURE && face.length === 4) {
                // no structural springs for pressure type
                pairs = [[face[0], face[1]], [face[1], face[2]], [face[2], face[3]], [face[3], face[0]]];
            } else {
                pairs = face.map((p1, i) => face.slice(i + 1).map(p2 => [p1, p2])).flat();
            }

            pairs.forEach(pair => {

                // check pair is not already added
                if (added[pair[0]] && added[pair[0]].includes(pair[1])) {
                    return;
                }
                
                // add to pairs map
                if (!added[pair[0]]) added[pair[0]] = [];
                added[pair[0]].push(pair[1]);
                if (!added[pair[1]]) added[pair[1]] = [];
                added[pair[1]].push(pair[0]);

                // add spring
                const vec1 = new THREE.Vector3(vertices[3*pair[0]], vertices[3*pair[0]+1], vertices[3*pair[0]+2]);
                const vec2 = new THREE.Vector3(vertices[3*pair[1]], vertices[3*pair[1]+1], vertices[3*pair[1]+2]);
                const spring = new CANNON.Spring();
                spring.bodyA = this.bodies[pair[0]];
                spring.bodyB = this.bodies[pair[1]];
                spring.restLength = vec1.distanceTo(vec2);
                // @ts-ignore -- typo
                spring.stiffness = this.stiffness;
                spring.damping = this.damping;
                this.springs.push(spring);

                // add debug line
                debug_line_points.push(vec1, vec2);

            });

        });

        // create wireframe geometry
        const debug_line_geom = new THREE.BufferGeometry().setFromPoints(debug_line_points);
        this.debug_lines = new THREE.LineSegments(debug_line_geom, new THREE.LineBasicMaterial({ color: this.color }));

        // create three.js mesh
        const material = new THREE.MeshPhongMaterial({ 
            color: this.color, 
            side: THREE.DoubleSide,
            opacity: 0.3, 
            transparent: true
        });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.Uint16BufferAttribute(indices_tri, 1));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.userData['soft'] = this;

    };

    /**
     * Copy position from physics simulation to rendered mesh
     */
    update() {

        const vertices = this.mesh.geometry.getAttribute('position');

        // update mesh vertices to body position
        this.bodies.forEach((body, i) => {
            vertices.setXYZ(i, body.position.x, body.position.y, body.position.z);
            this.shape.vertices[3 * i] = body.position.x;
            this.shape.vertices[3 * i + 1] = body.position.y;
            this.shape.vertices[3 * i + 2] = body.position.z;
            this.shape.updateBoundingSphereRadius();
            this.debug_meshes[i].position.set(body.position.x, body.position.y, body.position.z);
        });

        vertices.needsUpdate = true;
        this.mesh.geometry.computeBoundingSphere();
        this.mesh.geometry.computeVertexNormals();

        const debug_line_points = [];

        // update lines to spring position
        this.springs.forEach((spring) => {
            const p1 = spring.bodyA.position as unknown as THREE.Vector3;
            const p2 = spring.bodyB.position as unknown as THREE.Vector3;
            debug_line_points.push(p1, p2);
        });
        
        this.debug_lines.geometry.setFromPoints(debug_line_points);

    };

    addSelf(scene: THREE.Scene, world: CANNON.World): void  {

        scene.add(this.mesh);

        this.bodies.forEach((b: CANNON.Body) => {
            world.addBody(b);
        });

        this.debug_meshes.forEach((m: THREE.Mesh) => {
            scene.add(m);
        });

        scene.add(this.debug_lines);
        
        // add additional force callback
        world.addEventListener('postStep', this.postStep.bind(this));

    }

    removeSelf(scene: THREE.Scene, world: CANNON.World): void {

        // add additional force callback
        world.removeEventListener('postStep', this.postStep.bind(this));

        scene.remove(this.debug_lines);

        this.debug_meshes.forEach((m: THREE.Mesh) => {
            scene.remove(m);
        });

        this.bodies.forEach((b: CANNON.Body) => {
            world.remove(b);
        });

        scene.remove(this.mesh);

    }

    postStep() {
        
        // apply spring force
        this.springs.forEach(spring => {
            if (spring.bodyA && spring.bodyB) {
                spring.applyForce();
            }
        });

        // apply volume force
        const force = -1 / this.getVolume() *  this.pressure;
        const tris = this.shape.indices.length / 3;

        for (let i = 0; i < tris; i++) {

            // get area of triangle
            let a = new CANNON.Vec3();
            let b = new CANNON.Vec3();
            let c = new CANNON.Vec3();
            this.shape.getTriangleVertices(i, a, b, c);
            const tri_area = area(a, b, c);

            // get surface normal
            const normal = new CANNON.Vec3();
            CANNON.Trimesh.computeNormal(a, b, c, normal);

            // get vertex indices
            const a_idx = this.shape.indices[3*i];
            const b_idx = this.shape.indices[3*i+1];
            const c_idx = this.shape.indices[3*i+2];

            // apply force to each body
            this.bodies[a_idx].applyForce(normal.scale(force * tri_area), this.bodies[a_idx].position);
            this.bodies[b_idx].applyForce(normal.scale(force * tri_area), this.bodies[b_idx].position);
            this.bodies[c_idx].applyForce(normal.scale(force * tri_area), this.bodies[c_idx].position);
        }

    }

    getSurfaceArea() {
        
        const tris = this.shape.indices.length / 3;
        let surfaceArea = 0;

        for (let i = 0; i < tris; i++) {
            let a = new CANNON.Vec3();
            let b = new CANNON.Vec3();
            let c = new CANNON.Vec3();
            this.shape.getTriangleVertices(i, a, b, c);
            surfaceArea += area(a, b, c);
        }

        return Math.abs(surfaceArea);

    }

    getVolume() {

        const tris = this.shape.indices.length / 3;
        let volume = 0;

        for (let i = 0; i < tris; i++) {
            let a = new CANNON.Vec3();
            let b = new CANNON.Vec3();
            let c = new CANNON.Vec3();
            this.shape.getTriangleVertices(i, a, b, c);
            volume += signedVolume(a, b, c);
        }

        return Math.abs(volume);

    }

}

function signedVolume(a: CANNON.Vec3, b: CANNON.Vec3, c: CANNON.Vec3) {
    return a.dot(b.cross(c)) / 6;
}

function area(a: CANNON.Vec3, b: CANNON.Vec3, c: CANNON.Vec3) {
    const ab = b.vsub(a);
    const ac = c.vsub(a);
    return ab.cross(ac).norm() / 2;
}