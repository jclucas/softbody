import './style.css';
import { MainDemo } from "./ts/demo-main";
import { icosphere_3 } from './assets/icosphere-3';

const demo = new MainDemo(icosphere_3);
demo.loop();

const form = document.getElementById('controls') as HTMLFormElement;

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const pressure = form.elements['pressure'];
    const stiffness = form.elements['spring'];
    const damping = form.elements['damping'];
    demo.respawn(pressure.value, stiffness.value, damping.value);
});