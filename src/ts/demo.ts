import * as CANNON from 'cannon';
import * as THREE from 'three';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import Stats from 'three/examples/jsm/libs/stats.module'

import { PhysObject } from './phys-object'
/**
 * Extensible class with code for physics, rendering, ui
 */
export class Demo {

    // DOM
    width: number;
    height: number;

    // rendering
    camera: THREE.PerspectiveCamera;
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;

    // physics
    world: CANNON.World;
    objects: PhysObject[];

    // UI
    cursor: THREE.Mesh;
    stats: Stats;

    // mouse interaction
    mouse: THREE.Vector2;
    raycaster: THREE.Raycaster;
    mouseDepth: number;
    mouseDown: boolean;

    constructor(id: string) {

        // DOM
        const element = document.getElementById(id);
        const aspect = 4 / 3;
        this.width = element.offsetWidth;
        this.height = this.width / aspect;

        // CAMERA
        
        this.camera = new THREE.PerspectiveCamera(50, aspect, 1, 1000);

        // SCENE

        this.scene = new THREE.Scene();

        // PHYSICS WORLD

        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.8, 0);

        // RENDERER

        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(this.width, this.height);
        element.appendChild(this.renderer.domElement);
        this.renderer.autoClear = false;

        // add stats panel
        this.stats = Stats();
        element.appendChild(this.stats.domElement);

        // bind event listeners
        element.addEventListener("mousemove", this.onMouseMoveEvent.bind(this));
        element.addEventListener("mouseup", this.onMouseUpEvent.bind(this));
        element.addEventListener("mouseout", this.onMouseUpEvent.bind(this));
        element.addEventListener("mousedown", this.onMouseDownEvent.bind(this));

    }

    init() {

        // CAMERA
        this.initCamera(this.camera);

        // LIGHTING
        let lights = [];
        this.initLighting(lights);
        lights.forEach(light => {
            this.scene.add(light);
        });

        // OBJECTS

        // obj file loader
        const loader = new GLTFLoader();

        // list of all physics objects
        this.objects = [];

        this.initScene(this.scene, this.world, loader);

        // INTERACTION
        
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.mouseDepth = .5; 

        // create cursor
        const cursor_geom = new THREE.SphereGeometry(0.1);
        const cursor_mat = new THREE.MeshLambertMaterial({ color: 0xffffbb });
        this.cursor = new THREE.Mesh(cursor_geom, cursor_mat);
        this.cursor.translateX(-10); // hide until active
        let rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2, -Math.PI/2, Math.PI/6));
        this.cursor.setRotationFromQuaternion(rotation.premultiply(this.camera.quaternion));
        this.scene.add(this.cursor);

        // bind game loop function
        this.loop = this.loop.bind(this);

    }

     /**
     * Add a physics object to the state
     * @param {PhysObject} obj 
     */
      add(obj: PhysObject): void {
        
        obj.addSelf(this.scene, this.world);
        this.objects.push(obj);
    
    }

    /**
     * Remove a physics object from the state
     * @param {int} index index of a PhysObject
     */
    remove(index: number): void {

        const obj = this.objects[index];
        obj.removeSelf(this.scene, this.world);
        this.objects.splice(index, 1);

    }

    /**
     * Simulate a physics step and update all children accordingly
     */
    update(): void {

        const steps = 2;

        for (let step = 0; step < steps; step++) {
            this.world.step(1 / 60 / steps);
            
            // update all physics objects
            for (let i = 0; i < this.objects.length; i++) {
                this.objects[i].update();
            }
        }

    }

    /**
     * Main simulation loop
     */
    loop(): void {

        requestAnimationFrame(this.loop);
        this.update();
        this.render();
        this.stats.update();

    }

    render(): void {

        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);

    }

    //// MOUSE INTERACTION

    onMouseMoveEvent(event: MouseEvent) {

        // save mouse position for raycaster
        this.mouse.x = (event.offsetX / this.width) * 2 - 1;
        this.mouse.y = -(event.offsetY / this.height) * 2 + 1;

        // move cursor on cursor plane
        var mousePos = new THREE.Vector3(this.mouse.x, this.mouse.y, this.mouseDepth);
        mousePos = mousePos.unproject(this.camera);
        this.cursor.position.copy(mousePos);

        this.onMouseMove(this.mouse);

        if (this.mouseDown) {            
            this.onMouseDrag(this.mouse);
        }
        
    }

    onMouseDownEvent(event: MouseEvent) {

        this.mouseDown = true;

        // update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);

        this.onMouseDown(this.mouse, this.raycaster);

    }

    onMouseUpEvent(event: MouseEvent) {
        this.mouseDown = false;
        this.onMouseUp();
    }

    /// TEMPLATE FUNCTIONS

    initCamera(camera: THREE.Camera): void {

        camera.position.set(0, 0, 5);
        camera.setRotationFromEuler(new THREE.Euler(-5 * Math.PI / 180, 0, 0));

    }

    initLighting(lights: THREE.Light[]): void {

        const light = new THREE.PointLight();
        light.position.set(0, 15, 10);
        light.castShadow = true;
        lights.push(light);

        const ambient = new THREE.AmbientLight(0x444444, 1);
        lights.push(ambient);

    }

    initScene(scene: THREE.Scene, world: CANNON.World, loader) {}

    initUI(scene: THREE.Scene, world: CANNON.World, loader) {}
    
    onMouseDown(position: {x: number, y: number}, raycaster: THREE.Raycaster) {}

    onMouseUp() {}

    onMouseMove(position: {x: number, y: number}) {}

    onMouseDrag(position: {x: number, y: number}) {}

}