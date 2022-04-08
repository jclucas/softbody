import * as CANNON from "cannon";
import * as THREE from "three";
import { PhysObject } from "./phys-object";
import { SoftObject, SoftOptions, SoftType } from "./soft-object";

export interface HybridOptions {
    outer_options?: SoftOptions;
    inner_options?: SoftOptions;
    offset?: number;
    stiffness?: number;
    damping?: number;
    color?: number;
    debug?: boolean;
}

export class HybridSoftObject implements PhysObject {

    // todo: remove from interface ?
    mesh: THREE.Mesh;
    bodies: CANNON.Body[];

    inner_body: SoftObject;
    outer_body: SoftObject;

    springs: CANNON.Spring[];
    debug_lines: THREE.LineSegments;

    offset: number;
    stiffness: number;
    damping: number;

    color: number;
    debug: boolean;

    constructor(vertices: number[], faces: number[][], options?: HybridOptions) {
        
        // structure options
        this.offset = options?.offset ?? 0.2;
        this.stiffness = options?.stiffness ?? 200;
        this.damping = options?.damping ?? 0.4;

        // visual options
        this.color = options?.color ?? 0xffff00;
        this.debug = options?.debug ?? true;

        // component object options
        const inner_options = options?.inner_options ?? {};
        const outer_options = options?.outer_options ?? {};

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
        inner_options.type = SoftType.PRESSURE;
        inner_options.color = 0x0000ff;
        this.inner_body = new SoftObject(vertices_inner, faces, inner_options);

        // create outer body
        outer_options.type = SoftType.PRESSURE;
        this.outer_body = new SoftObject(vertices, faces, outer_options);

        // add radial springs
        this.springs = [];
        const debug_line_points = [];

        this.inner_body.bodies.forEach((body_a: CANNON.Body, i: number) => {

            const body_b = this.outer_body.bodies[i];

            const vec1 = new THREE.Vector3(body_a.position.x, body_a.position.y, body_a.position.z);
            const vec2 = new THREE.Vector3(body_b.position.x, body_b.position.y, body_b.position.z);
            const spring = new CANNON.Spring();
            spring.bodyA = body_a;
            spring.bodyB = body_b;
            spring.restLength = vec1.distanceTo(vec2);
            // @ts-ignore -- typo
            spring.stiffness = this.stiffness;
            spring.damping = this.damping;
            this.springs.push(spring);

            // add debug line
            if (this.debug) {
                debug_line_points.push(vec1, vec2);
            }

        });

        // create wireframe geometry
        if (this.debug) {
            const debug_line_geom = new THREE.BufferGeometry().setFromPoints(debug_line_points);
            this.debug_lines = new THREE.LineSegments(debug_line_geom, new THREE.LineBasicMaterial({ color: this.color }));
        }

    }
    
    /**
     * Copy position from physics simulation to rendered mesh
     */
    update() {

        this.inner_body.update();
        this.outer_body.update();

        if (this.debug) {

            const debug_line_points = [];

            // update lines to spring position
            this.springs.forEach((spring) => {
                const p1 = spring.bodyA.position as unknown as THREE.Vector3;
                const p2 = spring.bodyB.position as unknown as THREE.Vector3;
                debug_line_points.push(p1, p2);
            });
            
            this.debug_lines.geometry.setFromPoints(debug_line_points);

        }

    };

    addSelf(scene: THREE.Scene, world: CANNON.World): void  {

        this.inner_body.addSelf(scene, world);
        this.outer_body.addSelf(scene, world);

        if (this.debug) {
            scene.add(this.debug_lines);
        }
        
        // add additional force callback
        world.addEventListener('postStep', this.postStep.bind(this));

    }

    removeSelf(scene: THREE.Scene, world: CANNON.World): void {

        // remove additional force callback
        world.removeEventListener('postStep', this.postStep.bind(this));

        scene.remove(this.debug_lines);

        this.inner_body.removeSelf(scene, world);
        this.outer_body.removeSelf(scene, world);

    }

    postStep() {
        
        // apply spring force
        this.springs.forEach(spring => {
            if (spring.bodyA && spring.bodyB) {
                spring.applyForce();
            }
        });

    }

}