import * as CANNON from "cannon";
import * as THREE from "three";
import { Mesh, MeshPhongMaterial } from "three";

export class SoftObject {

    mesh: THREE.Mesh;
    bodies: CANNON.Body[];
    springs: CANNON.Spring[];

    debugMeshes: THREE.Mesh[];

    /**
     * Read geometry to a new physics object.
     * @param vertices array of CANNON.Vec3 vertices
     * @param faces array of arrays of vertex indices
     * @param mass of CANNON.Body
     */
    constructor(vertices: number[], indices: number[], mass: number) {

        // due to converting from obj
        indices.forEach((index, i, arr) => arr[i] = index - 1);

        const shape = new CANNON.Trimesh(vertices, indices);
        shape.updateEdges();

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
            body.addShape(new CANNON.Sphere(0.1));
            body.position.set(x, y, z);
            this.bodies.push(body);

            // debug meshes
            const geom = new THREE.SphereGeometry(0.1);
            const mat = new MeshPhongMaterial({ color: 0xff0088, side: THREE.DoubleSide });
            const mesh = new Mesh(geom, mat);
            mesh.position.set(x, y, z);
            this.debugMeshes.push(mesh);

        }

        this.springs = [];

        // add spring between each vertex
        for (let i = 0; i < indices.length; i+= 3) {
            
            const a = indices[i];
            const b = indices[i+1];
            const c = indices[i+2];

            [[a, b], [b, c], [c, a]].forEach(pair => {
                const spring = new CANNON.Spring();
                spring.bodyA = this.bodies[pair[0]];
                spring.bodyB = this.bodies[pair[1]];
                this.springs.push(spring);
            });

        }

        // create three.js mesh
        const material = new MeshPhongMaterial({ color: 0xff0000, side: THREE.DoubleSide });
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.Uint16BufferAttribute(indices, 1));
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
            this.debugMeshes[i].position.set(body.position.x, body.position.y, body.position.z);
        });

        vertices.needsUpdate = true;

    };

}