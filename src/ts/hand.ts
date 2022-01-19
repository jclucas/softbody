import * as CANNON from 'cannon';

/**
* Demo "hand" for interacting with objects.
*/
export class Hand {

    world: CANNON.World;
    joint: CANNON.Body;
    constraints: CANNON.PointToPointConstraint[];
    active: boolean;

    constructor(world: CANNON.World) {

        // physics world
        this.world = world;

        // body to which held objects are constrained
        this.joint = new CANNON.Body({ mass: 0 });
        this.joint.addShape(new CANNON.Sphere(0.1));
        this.joint.collisionFilterGroup = 0;
        this.joint.collisionFilterMask = 0;
        this.world.addBody(this.joint);

        // point-to-point constraints
        this.constraints = [];

        // true when we are holding something
        this.active = false;

    }

    /**
     * Pick up an object
     * @param body selected object
     * @param pos world position of mouse click
     */
    grab(body: CANNON.Body, pos: CANNON.Vec3) {

        // register activity
        this.active = true;

        // move joint to click position
        this.joint.position.copy(pos);

        // calculate pivot point (object space)
        const relPos = pos.vsub(body.position);
        const antiRot = body.quaternion.inverse();
        const pivot = antiRot.vmult(relPos);

        // create and add constraint
        const constraint = new CANNON.PointToPointConstraint(body, pivot, this.joint, new CANNON.Vec3(0,0,0));
        this.constraints.push(constraint);
        this.world.addConstraint(constraint);

    }

    grabFace(bodies: CANNON.Body[], pos: CANNON.Vec3) {

        // register activity
        this.active = true;

        // move joint to click position
        this.joint.position.set(pos.x, pos.y, pos.z);

        bodies.forEach(body => {

            // create and add constraint
            const constraint = new CANNON.DistanceConstraint(body, this.joint, body.position.distanceTo(pos));
            this.constraints.push(constraint);
            this.world.addConstraint(constraint);

        });
    }

    /**
     * Let go of the currently held object
     */
    release() {

        // remove constraint
        this.constraints.forEach(constraint => {
            this.world.removeConstraint(constraint);
        });

        this.constraints = [];
        this.active = false;
    
    }

    /**
     * Move the joint body to a new mouse position
     * @param pos world space mouse position
     */
    move(pos: CANNON.Vec3) {

        // update joint if we're holding something
        if (this.active) {
            this.joint.position.copy(pos);
            this.constraints.forEach(constraint => {
                constraint.update();
            });
        }

    }

}