import './style.css';
import { MainDemo } from "./ts/demo-main";
import { SoftOptions, SoftType } from './ts/soft-object';
import { icosphere_2 } from './assets/icosphere-2';
import { icosphere_3 } from './assets/icosphere-3';
import { bunny } from './assets/bunny';
import { HybridOptions } from './ts/hybrid-soft-object';

const demo = new MainDemo(icosphere_3);
demo.loop();

const form = document.getElementById('controls') as HTMLFormElement;
const modelSelect = document.getElementById('model') as HTMLSelectElement;

modelSelect.addEventListener('change', (event) => {
    const selected: string = modelSelect.selectedOptions[0].value;
    const ip = document.getElementById('inner_pressure') as HTMLInputElement;
    const is = document.getElementById('inner_spring') as HTMLInputElement;
    const id = document.getElementById('inner_damping') as HTMLInputElement;
    const io = document.getElementById('inner_offset') as HTMLInputElement;

    if (selected === 'hybrid') {
        ip.disabled = false;
        is.disabled = false;
        id.disabled = false;
        io.disabled = false;
    } else {
        ip.disabled = true;
        is.disabled = true;
        id.disabled = true;
        io.disabled = true;
    }
});

form.addEventListener('submit', (event) => {
    event.preventDefault();
    const geom = form.elements['geom']
    const model = form.elements['model'];
    const inner_pressure = form.elements['inner_pressure'];
    const inner_spring = form.elements['inner_spring'];
    const inner_damping = form.elements['inner_damping'];
    const inner_offset = form.elements['inner_offset'];
    const outer_pressure = form.elements['outer_pressure'];
    const outer_spring = form.elements['outer_spring'];
    const outer_damping = form.elements['outer_damping'];
    
    // load new geometry
    if (geom.value === 'bunny') {
        demo.loadGeometry(bunny);
    } else if (geom.value === 'icosphere_2') { 
        demo.loadGeometry(icosphere_2);
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
        const options: HybridOptions = {
            inner_options: inner_options,
            outer_options: outer_options,
            offset: inner_offset.value
        }
        demo.respawn_hybrid(options);
    } else {
        demo.respawn_pressure(outer_options);
    }
});