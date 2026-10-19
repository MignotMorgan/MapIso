import { FactoryForm } from 'Control/form.js';
import { FormView } from '../formView.js';
import { PaintFormView } from './paintFormView.js';

export class FactoryFormView extends FactoryForm{
    createControl(){ return new FormView(); }
    createPaint(x, y, width, height, hide = false){
        return new PaintFormView(x, y, width, height, hide);
    }
}
