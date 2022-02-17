import * as CANNON from "cannon";
import * as THREE from "three";
import { PhysObject } from "./phys-object";
import { SoftObject, SoftOptions, SoftType } from "./soft-object";

export class HybridSoftObject implements PhysObject {

    // todo: remove from interface ?
    mesh: THREE.Mesh;
    bodies: CANNON.Body[];

    inner_body: SoftObject;
    outer_body: SoftObject;

    offset = 0.1;

    constructor(vertices: number[], faces: number[][], options?: SoftOptions) {

        // triangulate
        const indices_tri = [];
        faces.forEach(face => {
            if (face.length === 3) {
                indices_tri.push(...face);
            } else if (face.length === 4) {
                indices_tri.push(face[0], face[1], face[2]);
                indices_tri.push(face[2], face[3], face[0]);
            }
        });

        // get vertex normals
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.Uint16BufferAttribute(indices_tri, 1));
        geometry.computeVertexNormals();
        const normals = geometry.getAttribute('normal').array;

        // calculate inner vertex positions
        const vertices_inner = [];

        for (let i = 0; i < vertices.length; i+= 3) {
            
            const x = vertices[i];
            const y = vertices[i+1];
            const z = vertices[i+2];

            const normal_x = normals[i];
            const normal_y = normals[i+1];
            const normal_z = normals[i+2];

            vertices_inner.push(x - this.offset * normal_x)
            vertices_inner.push(y - this.offset * normal_y)
            vertices_inner.push(z - this.offset * normal_z)

        }


        // create inner body
        const inner_options = options && { type: SoftType.PRESSURE }
        this.inner_body = new SoftObject(vertices_inner, faces, inner_options);

        // create outer body
        const outer_options = options && { type: SoftType.MASS_SPRING }
        this.outer_body = new SoftObject(vertices, faces, outer_options);

        // add radial springs
    
    }
    
    /**
     * Copy position from physics simulation to rendered mesh
     */
    update() {

        this.inner_body.update();
        this.outer_body.update();

    };

    addSelf(scene: THREE.Scene, world: CANNON.World): void  {

        this.inner_body.addSelf(scene, world);
        this.outer_body.addSelf(scene, world);

    }

    removeSelf(scene: THREE.Scene, world: CANNON.World): void {

        this.inner_body.removeSelf(scene, world);
        this.outer_body.removeSelf(scene, world);

    }

}