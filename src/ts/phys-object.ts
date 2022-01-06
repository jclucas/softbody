import * as CANNON from 'cannon';
import * as THREE from 'three';
import { Mesh, MeshPhongMaterial } from 'three';

export class PhysObject {

    mesh: THREE.Mesh;
    bodies: CANNON.Body[];

    /**
     * Read geometry to a new physics object.
     * @param vertices array of CANNON.Vec3 vertices
     * @param faces array of arrays of vertex indices
     * @param mass of CANNON.Body
     */
    constructor(vertices: number[], indices: number[], mass: number) {

        // due to converting from obj
        indices.forEach((index, i, arr) => arr[i] = index - 1);

        // create cannon.js body
        const shape = new CANNON.Trimesh(vertices, indices);
        const body = new CANNON.Body({ mass: mass });
        this.bodies = [];
        this.bodies.push(body);
        body.addShape(shape);

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

        const pos = this.bodies[0].position;
        const dir = this.bodies[0].quaternion;
        this.mesh.position.set(pos.x, pos.y, pos.z);
        this.mesh.quaternion.set(dir.x, dir.y, dir.z, dir.w);

    };

}