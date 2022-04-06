import './style.css';
import { MainDemo } from "./ts/demo-main";
import { SoftOptions, SoftType } from './ts/soft-object';
import { icosphere_3 } from './assets/icosphere-3';
import { icosphere } from './assets/icosphere';
import { bunny } from './assets/bunny';

const demo = new MainDemo(icosphere_3);
demo.loop();

const form = document.getElementById('controls') as HTMLFormElement;
const modelSelect = document.getElementById('model') as HTMLSelectElement;

modelSelect.addEventListener('change', (event) => {
    const selected: string = modelSelect.selectedOptions[0].value;
    const ip = document.getElementById('inner_pressure') as HTMLInputElement;
    const is = document.getElementById('inner_spring') as HTMLInputElement;
    const id = document.getElementById('inner_damping') as HTMLInputElement;

    if (selected === 'hybrid') {
        ip.disabled = false;
        is.disabled = false;
        id.disabled = false;
    } else {
        ip.disabled = true;
        is.disabled = true;
        id.disabled = true;
    }
});

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const geom = form.elements['geom']
    const model = form.elements['model'];
    const inner_pressure = form.elements['inner_pressure'];
    const inner_spring = form.elements['inner_spring'];
    const inner_damping = form.elements['inner_damping'];
    const outer_pressure = form.elements['outer_pressure'];
    const outer_spring = form.elements['outer_spring'];
    const outer_damping = form.elements['outer_damping'];
    
    // load new geometry
    if (geom.value === 'bunny') {
        demo.loadGeometry(bunny);
    } else if (geom.value === 'icosphere_1') { 
        demo.loadGeometry(icosphere);
    } else {
        demo.loadGeometry(icosphere_3);
    }

    const outer_options: SoftOptions = {
        pressure: outer_pressure.value,
        stiffness: outer_spring.value,
        damping: outer_damping.value,
    }

    if (model.value === 'hybrid') {
        const inner_options: SoftOptions = {
            pressure: inner_pressure.value,
            stiffness: inner_spring.value,
            damping: inner_damping.value,
        }
        demo.respawn(outer_options, inner_options);
    } else {
        demo.respawn(outer_options, undefined, SoftType.PRESSURE);
    }
});