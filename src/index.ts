import './style.css';
import { MainDemo } from "./ts/demo-main";
import { SoftOptions } from './ts/soft-object';
import { icosphere_3 } from './assets/icosphere-3';

const demo = new MainDemo(icosphere_3);
demo.loop();

const form = document.getElementById('controls') as HTMLFormElement;

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const inner_pressure = form.elements['inner_pressure'];
    const inner_spring = form.elements['inner_spring'];
    const inner_damping = form.elements['inner_damping'];
    const outer_pressure = form.elements['outer_pressure'];
    const outer_spring = form.elements['outer_spring'];
    const outer_damping = form.elements['outer_damping'];
    
    const inner_options: SoftOptions = {
        pressure: inner_pressure.value,
        stiffness: inner_spring.value,
        damping: inner_damping.value,
    }
        
    const outer_options: SoftOptions = {
        pressure: outer_pressure.value,
        stiffness: outer_spring.value,
        damping: outer_damping.value,
    }

    demo.respawn(inner_options, outer_options);
});