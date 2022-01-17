import * as CANNON from "cannon";
import * as THREE from "three";
import { Mesh, MeshPhongMaterial } from "three";
import { PhysObject } from "./phys-object";

export enum SoftType {
    MASS_SPRING,
    PRESSURE,
    HYBRID
}

export class SoftObject implements PhysObject {

    mesh: THREE.Mesh;
    shape: CANNON.Trimesh;
    bodies: CANNON.Body[];
    springs: CANNON.Spring[];

    type: SoftType = SoftType.PRESSURE;

    pressure: number = this.type === SoftType.MASS_SPRING ? 0 : 10;
    stiffness: number = 50;
    damping: number = 0.2;
    
    debugMeshes: THREE.Mesh[];

    /**
     * Read geometry to a new physics object.
     * @param vertices array of CANNON.Vec3 vertices
     * @param faces array of arrays of vertex indices
     * @param mass of CANNON.Body
     */
    constructor(vertices: number[], faces: number[][], mass: number, type?: SoftType) {

        if (!!type) {
            this.type = type;
        }

        // due to converting from obj
        faces.forEach((face: number[]) => {
            face.forEach((index, i, arr) => arr[i] = index - 1);
        });

        const indices_tri = []

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

        // mass of each point
        const pt_mass = mass / vertices.length;

        this.debugMeshes = [];

        // for each vertex
        for (let i = 0; i < vertices.length; i+= 3) {
            
            const x = vertices[i];
            const y = vertices[i+1];
            const z = vertices[i+2];

            const body = new CANNON.Body({ mass: pt_mass });
            body.addShape(new CANNON.Sphere(0.05));
            body.position.set(x, y, z);
            this.bodies.push(body);

            // debug meshes
            const geom = new THREE.SphereGeometry(0.05);
            const mat = new MeshPhongMaterial({ color: 0xff0088, side: THREE.DoubleSide });
            const mesh = new Mesh(geom, mat);
            mesh.position.set(x, y, z);
            this.debugMeshes.push(mesh);

        }

        this.springs = [];

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
                // @ts-ignore
                spring.stiffness = this.stiffness;
                spring.damping = this.damping;
                this.springs.push(spring);

            });

        });

        // create three.js mesh
        const material = new MeshPhongMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.Uint16BufferAttribute(indices_tri, 1));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        this.mesh = new Mesh(geometry, material);

    };

    /**
     * Copy position from physics simulation to rendered mesh
     */
    update() {

        const vertices = this.mesh.geometry.getAttribute('position');

        this.bodies.forEach((body, i) => {
            vertices.setXYZ(i, body.position.x, body.position.y, body.position.z);
            this.shape.vertices[3 * i] = body.position.x;
            this.shape.vertices[3 * i + 1] = body.position.y;
            this.shape.vertices[3 * i + 2] = body.position.z;
            this.shape.updateBoundingSphereRadius();
            this.debugMeshes[i].position.set(body.position.x, body.position.y, body.position.z);
        });

        vertices.needsUpdate = true;

        this.mesh.geometry.computeBoundingSphere();
        this.mesh.geometry.computeVertexNormals();

    };

    addSelf(scene: THREE.Scene, world: CANNON.World): void  {

        scene.add(this.mesh);

        this.bodies.forEach((b: CANNON.Body) => {
            world.addBody(b);
        });

        this.debugMeshes.forEach((m: THREE.Mesh) => {
            scene.add(m);
        });
        
        // add additional force callback
        world.addEventListener('postStep', this.postStep.bind(this));

    }

    removeSelf(scene: THREE.Scene, world: CANNON.World): void {

        // add additional force callback
        world.removeEventListener('postStep', this.postStep.bind(this));

        this.debugMeshes.forEach((m: THREE.Mesh) => {
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
            spring.applyForce();
        });

        // apply volume force
        const force = 1 / this.shape.volume() * this.getSurfaceArea() * this.pressure;
        
        let center = new CANNON.Vec3();
        this.bodies.forEach(body => center.vadd(body.position, center));
        center.scale(1 / this.bodies.length, center);

        this.bodies.forEach((body, i) => {
            const normal = body.position.vsub(center).unit();
            body.applyForce(normal.scale(force), body.position);
        });

    }

    getSurfaceArea() {
        this.shape.updateBoundingSphereRadius();
        return this.shape.boundingSphereRadius * 4 * Math.PI / 3;
    }

}