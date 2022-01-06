import { AmbientLight, DirectionalLight, Euler, Mesh, MeshLambertMaterial, PerspectiveCamera, Quaternion, Raycaster, Scene, SphereGeometry, Vector2, Vector3, WebGLRenderer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { World } from 'cannon'

import { PhysObject } from './phys-object'
import { SoftObject } from './soft-object';

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
    objects: any[];

    // UI
    cursor: Mesh;

    // mouse interaction
    mouse: THREE.Vector2;
    raycaster: THREE.Raycaster;
    mouseDepth: number;
    mouseDown: boolean;

    constructor(id: string) {

        // DOM
        
        let element = document.getElementById(id);
        let aspect = 4 / 3;
        this.width = element.offsetWidth;
        this.height = this.width / aspect;

        // CAMERA
        
        this.camera = new PerspectiveCamera(50, aspect, 1, 1000);

        // SCENE

        this.scene = new Scene();

        // PHYSICS WORLD

        this.world = new World();
        this.world.gravity.set(0, -9.8, 0);

        // RENDERER

        this.renderer = new WebGLRenderer();
        this.renderer.setSize(this.width, this.height);
        element.appendChild(this.renderer.domElement);
        this.renderer.autoClear = false;

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
        
        this.mouse = new Vector2();
        this.raycaster = new Raycaster();
        this.mouseDepth = .5; 

        // create cursor
        const cursor_geom = new SphereGeometry(0.1);
        const cursor_mat = new MeshLambertMaterial({ color: 0xffffbb });
        this.cursor = new Mesh(cursor_geom, cursor_mat);
        this.cursor.translateX(-10); // hide until active
        let rotation = new Quaternion().setFromEuler(new Euler(Math.PI/2, -Math.PI/2, Math.PI/6));
        this.cursor.setRotationFromQuaternion(rotation.premultiply(this.camera.quaternion));
        this.scene.add(this.cursor);

        // bind game loop function
        this.loop = this.loop.bind(this);

    }

     /**
     * Add a physics object to the state
     * @param {PhysObject} obj 
     */
      add(obj: SoftObject): void {
        
        this.scene.add(obj.mesh);
        obj.bodies.forEach((b: CANNON.Body) => {
            this.world.addBody(b);
        });
        this.objects.push(obj);
        obj.debugMeshes.forEach((m) => {
            this.scene.add(m);
        });

        // add springs
        this.world.addEventListener('postStep', function(event) {
            obj.springs.forEach(spring => {
                spring.applyForce();
            }); 
        });

    }

    /**
     * Remove a physics object from the state
     * @param {int} index index of a PhysObject
     */
    remove(index: number): void {

        var obj = this.objects[index];
        obj.bodies.forEach((b: CANNON.Body) => {
            this.world.remove(b);
        });
        this.scene.remove(obj.mesh);
        this.objects.splice(index, 1);

    }

    /**
     * Simulate a physics step and update all children accordingly
     */
    update(): void {

        this.world.step(1 / 60);
        
        // update all physics objects
        for (var i = 0; i < this.objects.length; i++) {
            this.objects[i].update();
        }

    }

    /**
     * Main simulation loop
     */
    loop(): void {

        requestAnimationFrame(this.loop);
        this.update();
        this.render();

    }

    render(): void {

        this.renderer.clear();
        this.renderer.render(this.scene, this.camera);

    }

    static readShape(data, mass) {

        var phys_vertices = [];

        // get vertices
        for (var i = 0; i < data.vertices.length; i += 3) {
            phys_vertices.push(new CANNON.Vec3(data.vertices[i], data.vertices[i+1], data.vertices[i+2]));
        }

        return new PhysObject(phys_vertices, data.faces, mass);

    }

    //// MOUSE INTERACTION

    onMouseMoveEvent(event) {

        // save mouse position for raycaster
        this.mouse.x = (event.offsetX/ this.width) * 2 - 1;
        this.mouse.y = -(event.offsetY / this.height) * 2 + 1;

        // move cursor on cursor plane
        var mousePos = new Vector3(this.mouse.x, this.mouse.y, this.mouseDepth);
        mousePos = mousePos.unproject(this.camera);
        this.cursor.position.copy(mousePos);

        this.onMouseMove(this.mouse);

        if (this.mouseDown) {            
            this.onMouseDrag(this.mouse);
        }
        
    }

    onMouseDownEvent(event) {

        this.mouseDown = true;

        // update raycaster
        this.raycaster.setFromCamera(this.mouse, this.camera);

        this.onMouseDown(this.mouse, this.raycaster);

    }

    onMouseUpEvent(event) {
        this.mouseDown = false;
        this.onMouseUp();
    }

    /// TEMPLATE FUNCTIONS

    initCamera(camera: THREE.Camera): void {

        camera.position.set(0, 0, 5);
        camera.setRotationFromEuler(new Euler(-5 * Math.PI / 180, 0, 0));

    }

    initLighting(lights: THREE.Light[]): void {

        let light = new DirectionalLight();
        light.position.set(10, 10, 10);
        light.castShadow = true;
        lights.push(light);

        let ambient = new AmbientLight(0x444444, 1);
        lights.push(ambient);

    }

    initScene(scene: THREE.Scene, world: CANNON.World, loader: GLTFLoader) {}

    initUI(scene, world, loader) {}
    
    onMouseDown(position, raycaster) {}

    onMouseUp() {}

    onMouseMove(position) {}

    onMouseDrag(position) {}

}