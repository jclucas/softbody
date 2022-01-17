import * as THREE from 'three';
import * as CANNON from 'cannon';
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import { Demo } from "./demo";
import { box_quad } from '../assets/box-quad'
import { box } from '../assets/box'
import { bunny } from '../assets/bunny'
import { icosphere } from '../assets/icosphere'
import Hand from "./hand";
import { SoftObject } from './soft-object';
import { icosphere_3 } from '../assets/icosphere-3';

export class MainDemo extends Demo {

    hand: Hand

    constructor() {
        super('demo');
        this.init();
    }

    initScene(scene: THREE.Scene, world: CANNON.World, loader: GLTFLoader) {

        scene.background = new THREE.Color( 0x94bcbc );

        // add a static surface
        const floor_body = new CANNON.Body({ mass: 0 });
        const floor_shape = new CANNON.Plane()
        floor_body.addShape(floor_shape);
        floor_body.position.set(0, -4, 0);
        floor_body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        world.addBody(floor_body);

        // corresponding mesh
        const floor_geom = new THREE.PlaneGeometry(20, 10);
        floor_geom.rotateX(-Math.PI / 2);
        floor_geom.translate(0, -4, 0);
        const floor_mat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
        const floor_mesh = new THREE.Mesh(floor_geom, floor_mat);
        scene.add(floor_mesh);

        // add a static wall
        const wall_body = new CANNON.Body({ mass: 0 });
        const wall_shape = new CANNON.Plane()
        wall_body.addShape(wall_shape);
        wall_body.position.set(0, 0, -5);
        world.addBody(wall_body);

        // corresponding mesh
        const wall_geom = new THREE.PlaneGeometry(20, 20);
        wall_geom.translate(0, 0, -5);
        const wall_mat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
        const wall_mesh = new THREE.Mesh(wall_geom, wall_mat);
        scene.add(wall_mesh);

        // add a static wall
        const left_body = new CANNON.Body({ mass: 0 });
        const left_shape = new CANNON.Plane()
        left_body.addShape(left_shape);
        left_body.position.set(-7, 0, 0);
        left_body.quaternion.setFromEuler(0, Math.PI / 2, 0);
        world.addBody(left_body);

        // add a static wall
        const right_body = new CANNON.Body({ mass: 0 });
        const right_shape = new CANNON.Plane()
        right_body.addShape(right_shape);
        right_body.position.set(7, 0, 0);
        right_body.quaternion.setFromEuler(0, -Math.PI / 2, 0);
        world.addBody(right_body);

        // add test object
        const physObj = new SoftObject(icosphere_3.vertices, icosphere_3.faces, 10);
        this.add(physObj);

        // for interaction with physics objects
        this.hand = new Hand(world);

    }

    onMouseDown(position, raycaster: THREE.Raycaster) {
        
        // cast into cannon world
        const ray = raycaster.ray;
        const origin = new CANNON.Vec3(ray.origin.x, ray.origin.y, ray.origin.z);
        const to = ray.direction.multiplyScalar(1000).add(ray.origin);
        let result = new CANNON.RaycastResult();
        this.world.rayTest(origin, new CANNON.Vec3(to.x, to.y, to.z), result);

        if (result.hasHit) {
            this.hand.grab(result.body, result.hitPointWorld);
        }

        // save location of clicked camera plane
        var worldPos = new THREE.Vector3();
        worldPos.set(result.hitPointWorld.x, result.hitPointWorld.y, result.hitPointWorld.z);
        this.mouseDepth = worldPos.project(this.camera).z;

    }

    onMouseDrag(position) {
    
        // unproject mouse position into world space
        var worldPosition = new THREE.Vector3(position.x, position.y, this.mouseDepth);
        worldPosition = worldPosition.unproject(this.camera);

        // update object position
        const pos = new CANNON.Vec3(worldPosition.x, worldPosition.y, worldPosition.z);
        this.hand.move(pos);
    }

    onMouseUp() {
        this.hand.release();
    }

}