import { Body, Plane, Vec3, World } from "cannon";
import * as THREE from "three";
import { BufferGeometryUtils, Color, Scene } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

import { Demo } from "./demo";
import { PhysObject } from "./phys-object";
import { bunny } from '../assets/bunny'

export class MainDemo extends Demo {

    constructor() {
        super('demo');
        this.init();
    }

    initScene(scene: Scene, world: World, loader: GLTFLoader) {

        scene.background = new Color( 0x94bcbc );

        // add a static surface
        const floor_body = new Body({ mass: 0 });
        const floor_shape = new Plane()
        floor_body.addShape(floor_shape);
        floor_body.position.set(0, -2, 0);
        floor_body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(floor_body);

        // corresponding mesh
        const floor_geom = new THREE.PlaneGeometry(5, 5);
        floor_geom.rotateX(-Math.PI / 2);
        floor_geom.translate(0, -2, 0);
        const floor_mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
        const floor_mesh = new THREE.Mesh(floor_geom, floor_mat);
        scene.add(floor_mesh);

        // add test object
        const physObj = new PhysObject(bunny.vertices, bunny.indices, 10);
        this.add(physObj);

    }

}