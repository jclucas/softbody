using System.Collections.Generic;
using UnityEngine;
using UnityEngine.SceneManagement;

/// <summary>
/// Elastic soft body system simulated by point masses and springs.
/// </summary>
public class SoftBody : MonoBehaviour {

    // PARAMETERS

    /// <summary>
    /// Mass of each particle
    /// </summary>
    public float mass = 1;

    /// <summary>
    /// Coefficient of restitution
    /// </summary>
    public float e = 0.5f;

    /// <summary>
    /// Stiffness of structural springs
    /// </summary>
    public float stiffness = 50;

    /// <summary>
    /// Damping ratio of structural springs where 1 indicates critical damping
    /// </summary>
    public float dampingRatio = 1;

    /// <summary>
    /// Stiffness of shear springs
    /// </summary>
    public float shearStiffness = 50;

    /// <summary>
    /// Damping ratio of bend springs where 1 indicates critical damping
    /// </summary>
    public float shearDampingRatio = 1;

    /// <summary>
    /// Stiffness of bend springs
    /// </summary>
    public float bendStiffness = 50;

    /// <summary>
    /// Damping ratio of bend springs where 1 indicates critical damping
    /// </summary>
    public float bendDampingRatio = 1;

    /// <summary>
    /// Number of subdivisions per edge
    /// </summary>
    public int subdiv = 0;

    // acceleration of gravity
    private static Vector3 gravity = new Vector3(0, -9.81f, 0);

    // damping coefficient
    private float damping;

    // shear damping coefficient
    private float shearDamping;

    // bend damping coefficient
    private float bendDamping;

    // GEOMETRY

    // reference to mesh filter
    private Mesh mesh;

    // dimension of each cube edge
    private int dim;

    // distance between adjacent points
    private float step;

    private Dictionary<Particle, List<int>> vertexMap;

    // EDGES

    public Dictionary<int, float>[] structural;

    public Dictionary<int, float>[] shear;

    public Dictionary<int, float>[] bend;

    // PARTICLES

    private ParticleSystem particles;

    // MOUSE INTERACTION

    private bool clicked = false;

    private int pinned;

    protected void Awake() {

        // initialize structure
        dim = 2 + subdiv;
        step = 1f / (subdiv + 1);
        particles = new ParticleSystem(dim * dim * dim, transform);
        CreateCube();

        // add global forces
        particles.AddForceField((p, state, dt) => state[p].mass * gravity);

        // calculate spring coefficients
        damping = dampingRatio * 2 * Mathf.Sqrt(mass * stiffness);
        shearDamping =  shearDampingRatio * 2 * Mathf.Sqrt(mass * shearStiffness);
        bendDamping = bendDampingRatio * 2 * Mathf.Sqrt(mass * bendStiffness);

        // add spring forces
        particles.AddForceField((p, state, dt) => {
            Vector3 f = Vector3.zero;
            foreach (var other in structural[p]) {
                var d = GetDisplacement(state[p].position, state[other.Key].position, other.Value);
                var v = GetRelativeVelocity(state[p], state[other.Key]);
                f += GetSpringForce(d, v, stiffness, damping);
            }
            return f;
        });

        particles.AddForceField((p, state, dt) => {
            Vector3 f = Vector3.zero;
            foreach (var other in shear[p]) {
                var d = GetDisplacement(state[p].position, state[other.Key].position, other.Value);
                var v = GetRelativeVelocity(state[p], state[other.Key]);
                f += GetSpringForce(d, v, shearStiffness, shearDamping);
            }
            return f;
        });

        particles.AddForceField((p, state, dt) => {
            Vector3 f = Vector3.zero;
            foreach (var other in bend[p]) {
                var d = GetDisplacement(state[p].position, state[other.Key].position, other.Value);
                var v = GetRelativeVelocity(state[p], state[other.Key]);
                f += GetSpringForce(d, v, bendStiffness, bendDamping);
            }
            return f;
        });

    }

    // Update is called once per frame
    protected void Update() {
        
        particles.Update();
        DetectCollisions();

        // demo utility -- reload scene with R
        if (Input.GetKey(KeyCode.R)) {
            SceneManager.LoadScene(SceneManager.GetActiveScene().name);
        }

        // handle mouse events
        if (!clicked && Input.GetMouseButtonDown(0)) {

            // check if a particle was selected
            var ray = Camera.main.ScreenPointToRay(Input.mousePosition);
            var particle = particles.GetParticleFromRay(ray);

            // pin that particle to the mouse position
            if (particle != null) {
                clicked = true;
                pinned = particle.GetValueOrDefault();
                particles.Pin(particle.GetValueOrDefault());
            }

        } else if (clicked && Input.GetMouseButtonUp(0)) {

            // unpin the pinned particle
            clicked = false;
            particles.Unpin(pinned);

        } else if (clicked) {

            // update the pinned position
            var mousePos = Input.mousePosition;
            mousePos.z = (Camera.main.transform.position - particles.GetPosition(pinned)).magnitude;
            var worldPos = Camera.main.ScreenToWorldPoint(mousePos);
            particles.SetPosition(pinned, transform.InverseTransformPoint(worldPos));

        }

        if (mesh) {
            UpdateGeometry();
        }

    }

    void OnDrawGizmosSelected() {

        if (structural != null) {

            Gizmos.color = Color.green;

            for (int p = 0; p < particles.size; p++) {
                foreach (var n in structural[p]) {
                    Gizmos.DrawLine(transform.TransformPoint(particles.GetPosition(p)), 
                            transform.TransformPoint(particles.GetPosition(n.Key)));
                }
            }

        }

        if (shear != null) {

            Gizmos.color = Color.yellow;

            for (int p = 0; p < particles.size; p++) {
                foreach (var n in shear[p]) {
                    Gizmos.DrawLine(transform.TransformPoint(particles.GetPosition(p)), 
                            transform.TransformPoint(particles.GetPosition(n.Key)));
                }
            }

        }

        if (bend != null) {

            Gizmos.color = Color.blue;

            for (int p = 0; p < particles.size; p++) {
                foreach (var n in bend[p]) {
                    Gizmos.DrawLine(transform.TransformPoint(particles.GetPosition(p)), 
                            transform.TransformPoint(particles.GetPosition(n.Key)));
                }
            }

        }

    }

    protected void DetectCollisions() {
        
        particles.DetectCollisions();

    }

    // PRIVATE METHODS

    private void CreateCube() {

        // construct dictionary of same points
        var points = new Dictionary<Vector3, List<int>>();

        // mesh data
        var vertices = new Vector3[6 * dim * dim];
        var triangles = new int[36 * (dim - 1) * (dim - 1)];
        var uvs = new Vector2[6 * dim * dim];

        // temp array for processing vertices per face
        var idx = new int[6];

        // generate verts for each face

        for (int i = 0; i < dim; i++) {

            for (int j = 0; j < dim; j++) {

                var u = -0.5f + i * step;
                var v = -0.5f + j * step;

                Vector3[] pts = {
                    new Vector3(0.5f, u, v),    // +x
                    new Vector3(-0.5f, u, v),   // -x
                    new Vector3(u, 0.5f, v),    // +y
                    new Vector3(u, -0.5f, v),   // -y
                    new Vector3(u, v, 0.5f),    // +z
                    new Vector3(u, v, -0.5f)    // -z
                };

                for (int face = 0; face < 6; face++) {
                    idx[face] = face * dim * dim + i * dim + j;
                    uvs[idx[face]] = new Vector2(u + 0.5f, v + 0.5f);
                }

                for (int face = 0; face < 6; face++) {

                    vertices[idx[face]] = pts[face];

                    // add to vector3 -> vertex map
                    if (!points.ContainsKey(pts[face])) {
                        points.Add(pts[face], new List<int>());
                    }

                    points[pts[face]].Add(idx[face]);

                }

            }

        }

        // generate triangles for each face
        var index = new int[6, 4];

        for (int i = 0; i < dim - 1; i++) {

            for (int j = 0; j < dim - 1; j++) {

                // 4 adjacent vertices
                for (int face = 0; face < 6; face++) {
                    index[face, 0] = face * dim * dim + i * dim + j;
                    index[face, 1] = face * dim * dim + i * dim + j + 1;
                    index[face, 2] = face * dim * dim + (i + 1) * dim + j;
                    index[face, 3] = face * dim * dim + (i + 1) * dim + j + 1;
                }

                for (int face = 0; face < 6; face++) {

                    var faceOffset = face * 6 * (dim - 1) * (dim - 1);

                    if (face == 0 || face == 3 || face == 4) {
                        triangles[faceOffset + 6 * (i * (dim - 1) + j)] = index[face, 2];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 1] = index[face, 1];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 2] = index[face, 0];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 3] = index[face, 1];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 4] = index[face, 2];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 5] = index[face, 3];
                    } else {
                        triangles[faceOffset + 6 * (i * (dim - 1) + j)] = index[face, 0];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 1] = index[face, 1];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 2] = index[face, 2];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 3] = index[face, 3];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 4] = index[face, 2];
                        triangles[faceOffset + 6 * (i * (dim - 1) + j) + 5] = index[face, 1];
                    }
                        
                }

            }

        }

        // create mesh
        mesh = new Mesh();
        mesh.vertices = vertices;
        mesh.triangles = triangles;
        mesh.uv = uvs;
        mesh.RecalculateNormals();
        mesh.RecalculateTangents();

        // attach mesh to game object
        GetComponent<MeshFilter>().mesh = mesh;

        // keep track of which mesh vertices to move with particles
        vertexMap = new Dictionary<Particle, List<int>>();

        // create particles
        for (int i = 0; i < dim; i++) {
            for (int j = 0; j < dim; j++) {
                for (int k = 0; k < dim; k++) {
                    var p = new Vector3(-0.5f + step * i, -0.5f + step * j, -0.5f + step * k);
                    var vertexList = points.ContainsKey(p) ? points[p] : new List<int>();
                    // TODO use only obj or index references
                    var particle = new Particle(transform.TransformPoint(p), mass, e);
                    particles.AddParticle(GetArrayIndex(i, j, k), particle);
                    vertexMap[particle] = vertexList;
                }
            }
        }

        // initialize adjacency list
        structural = new Dictionary<int, float>[particles.size];
        shear = new Dictionary<int, float>[particles.size];
        bend = new Dictionary<int, float>[particles.size];

        for (int i = 0; i < particles.size; i++) {
            structural[i] = new Dictionary<int, float>();
            shear[i] = new Dictionary<int, float>();
            bend[i] = new Dictionary<int, float>();
        } 

        // connect particles in sub-cube
        for (int plane = 0; plane < dim - 1; plane++) {
            for (int u = 0; u < dim; u++) {
                for (int v = 0; v < dim; v++) {
                    
                    AddStructuralSpring(GetArrayIndex(plane, u, v), GetArrayIndex(plane + 1, u, v));
                    AddStructuralSpring(GetArrayIndex(u, plane, v), GetArrayIndex(u, plane + 1, v));
                    AddStructuralSpring(GetArrayIndex(u, v, plane), GetArrayIndex(u, v, plane + 1));

                    if (plane < dim - 2) {
                        AddBendSpring(GetArrayIndex(plane, u, v), GetArrayIndex(plane + 2, u, v));
                        AddBendSpring(GetArrayIndex(u, plane, v), GetArrayIndex(u, plane + 2, v));
                        AddBendSpring(GetArrayIndex(u, v, plane), GetArrayIndex(u, v, plane + 2));
                    }
                
                }
            }
        }

        // planar shear springs
        for (int plane = 0; plane < dim; plane++) {
            for (int u = 0; u < dim - 1; u++) {
                for (int v = 0; v < dim - 1; v++) {
                    
                    AddStructuralSpring(GetArrayIndex(plane, u, v), GetArrayIndex(plane, u + 1, v + 1));
                    AddStructuralSpring(GetArrayIndex(plane, u + 1, v), GetArrayIndex(plane, u, v + 1));
                    AddStructuralSpring(GetArrayIndex(u, plane, v), GetArrayIndex(u + 1, plane, v + 1));
                    AddStructuralSpring(GetArrayIndex(u + 1, plane, v), GetArrayIndex(u, plane, v + 1));
                    AddStructuralSpring(GetArrayIndex(u, v, plane), GetArrayIndex(u + 1, v + 1, plane));
                    AddStructuralSpring(GetArrayIndex(u + 1, v, plane), GetArrayIndex(u, v + 1, plane));
                
                }
            }
        }

        // diagonal shear springs
        for (int i = 0; i < dim - 1; i++) {
            for (int j = 0; j < dim - 1; j++) {
                for (int k = 0; k < dim - 1; k++) {
                    
                    AddShearSpring(GetArrayIndex(i, j, k), GetArrayIndex(i + 1, j + 1, k + 1));
                    AddShearSpring(GetArrayIndex(i + 1, j, k), GetArrayIndex(i, j + 1, k + 1));
                    AddShearSpring(GetArrayIndex(i, j + 1, k), GetArrayIndex(i + 1, j, k + 1));
                    AddShearSpring(GetArrayIndex(i, j, k + 1), GetArrayIndex(i + 1, j + 1, k));
                
                }
            }
        }

    }

    private void UpdateGeometry() {

        var vertices = mesh.vertices;
        
        foreach (var p in vertexMap.Keys) {
            foreach (var i in vertexMap[p]) {
                vertices[i] = transform.InverseTransformPoint(p.position);
            }
        }

        mesh.vertices = vertices;
        mesh.RecalculateNormals();
        mesh.RecalculateTangents();

    }

    // HELPER METHODS

    private static Vector3 GetSpringForce(Vector3 d, Vector3 v, float k, float c) {
        return (d * k * -1) - (c * v);
    }

    public static Vector3 GetDisplacement(Vector3 a, Vector3 b, float expected) {
        if (a == b) {
            return Vector3.zero;
        }
        var actual = a - b;
        var displacement = Vector3.Magnitude(actual) - expected;
        return displacement * (actual / Vector3.Magnitude(actual));
    }

    public static Vector3 GetRelativeVelocity(Particle a, Particle b) {
        return Vector3.Project(a.velocity - b.velocity, a.position - b.position);
    }

    private int GetArrayIndex(int x, int y, int z) {
        return ((x * dim) + y) * dim + z; 
    }

    private void AddStructuralSpring(int p1, int p2) {
        if (!structural[p1].ContainsKey(p2)) {
            var dist = particles.GetDistance(p1, p2);
            structural[p1].Add(p2, dist);
            structural[p2].Add(p1, dist);
        }
    }

    private void AddShearSpring(int p1, int p2) {
        if (!shear[p1].ContainsKey(p2)) {
            var dist = particles.GetDistance(p1, p2);
            shear[p1].Add(p2, dist);
            shear[p2].Add(p1, dist);
        }
    }

    private void AddBendSpring(int p1, int p2) {
        if (!bend[p1].ContainsKey(p2)) {
            var dist = particles.GetDistance(p1, p2);
            bend[p1].Add(p2, dist);
            bend[p2].Add(p1, dist);
        }
    }

}
