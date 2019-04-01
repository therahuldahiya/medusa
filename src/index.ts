import {
  MODE,
  THRESHOLD,
  Target,
  InternalTarget,
  MedusaEventInit,
  MedusaOptions,
  PartialTarget,
} from './declarations';

import { thresholdsByPixels } from './utils';

const crypto = require('crypto');


class Medusa {
  static MODE = MODE;

  static THRESHOLD = THRESHOLD;

  private options : MedusaOptions;

  private internalTargets : Array<InternalTarget> = [];

  private idList: Array<string> = [];

  constructor(options : Partial<MedusaOptions>) {
    const defaults : MedusaOptions = {
      targets: {
        id: 'snakes',
        container: document.body,
        nodes: '.m-snake',
        threshold: Medusa.THRESHOLD.FULL,
        offsets: '',
        emitGlobal: false,
        callback: () => {},
        mode: Medusa.MODE.DEFAULT,
      },
    };

    this.options = { ...defaults, ...options };

    this.init();
  }

  private init() {
    Object.defineProperty(HTMLElement.prototype, 'medusaId', {
      value: '',
      configurable: true,
      enumerable: true,
      writable: true,
      get() {
        return this.medusaId;
      },
      set(val) {
        this.medusaId = val;
      },
    });

    this.addTarget(this.options.targets);
  }

  addTarget(newTargets : Array<PartialTarget> | PartialTarget) {
    if (Array.isArray(newTargets)) {
      newTargets.forEach((newTarget) => {
        const partialTarget = newTarget as Target;

        if (this.idList.findIndex(id => id === newTarget.id) < 0) {
          this.internalTargets.push(this.createInternalTarget(partialTarget));
          this.idList.push(partialTarget.id);
        } else {
          throw new Error(`The target id-key: '${newTarget.id}', already exist`);
        }
      });
    } else if (typeof newTargets === 'object') {
      const target = newTargets as Target;

      if (this.idList.findIndex(id => id === target.id) < 0) {
        this.internalTargets.push(this.createInternalTarget(target));
        this.idList.push(target.id);
      } else {
        throw new Error(`The target id-key: '${target}', already exist`);
      }
    } else {
      console.warn(`The targets is uncorrect`);
    }
  }

  removeTarget(targetId : string) {
    const indexTargetToRemove = this.internalTargets.findIndex(target => target.id === targetId);

    if (indexTargetToRemove < 0) {
      console.warn('The targets id doesn\'t exist');
    } else {
      const currentTarget = this.internalTargets[indexTargetToRemove];

      currentTarget.observedElements.forEach((node, i) => {
        (<IntersectionObserver>currentTarget.observerInstance).unobserve(node);
        currentTarget.observedElements.splice(i, 1);
      })

      if (currentTarget.observedElements.length === 0) {
        (<IntersectionObserver>currentTarget.observerInstance).disconnect();
        currentTarget.observerInstance = null;
        this.internalTargets.splice(indexTargetToRemove, 1);

        this.idList.filter(id => id !== targetId);
      }
    }
  }

  pushToTarget(idObserver : string, elToAdd : HTMLElement | Array<HTMLElement>) {
    const indexTarget = this.internalTargets.findIndex((internalTarget) => internalTarget.id === idObserver);

    if (indexTarget < 0) {
      console.warn('The targets id doesn\'t exist');
    } else {
      if (Array.isArray(elToAdd)) {
        elToAdd.forEach((node) => {
          (<any>node).medusaId = crypto.randomBytes(6).toString('hex');

          (<IntersectionObserver>this.internalTargets[indexTarget].observerInstance).observe(node);
          this.internalTargets[indexTarget].observedElements.push(node);
        });
      } else {
        (<any>elToAdd).medusaId = crypto.randomBytes(6).toString('hex');

        (<IntersectionObserver>this.internalTargets[indexTarget].observerInstance).observe(elToAdd);
        this.internalTargets[indexTarget].observedElements.push(elToAdd);
      }
    }
  }

  pullFromTarget(idObserver : string, elToRemove : HTMLElement | Array<HTMLElement>) {
    const indexTarget = this.internalTargets.findIndex((internalTarget) => internalTarget.id === idObserver);

    if (indexTarget < 0) {
      console.warn('The targets id doesn\'t exist');
    } else {
      const observer = this.internalTargets[indexTarget].observerInstance as IntersectionObserver;

      if (Array.isArray(elToRemove)) {
        elToRemove.forEach((node) => {
          const medusaId = (<any>elToRemove).medusaId;
          const elIndexToRemove = this.internalTargets[indexTarget].observedElements.findIndex((observedElement) => (<any>observedElement).medusaId === medusaId);

          if (elIndexToRemove < 0) {
            console.warn('The element isn\'t observed');
          } else {
            observer.unobserve(node);
            this.internalTargets[indexTarget].observedElements.splice(elIndexToRemove, 1);
          }
        });
      } else {
        const medusaId = (<any>elToRemove).medusaId;
        const elIndexToRemove = this.internalTargets[indexTarget].observedElements.findIndex((observedElement) => (<any>observedElement).medusaId === medusaId);

        if (elIndexToRemove < 0) {
          console.warn('The element isn\'t observed');
        } else {
          observer.unobserve(elToRemove);
          this.internalTargets[indexTarget].observedElements.splice(elIndexToRemove, 1);
        }
      }
      
    }
  }

  private createInternalTarget(optionsTarget : Target) {
    const internalTarget : InternalTarget = {
      id: optionsTarget.id,
      observerInstance: null,
      observedElements: [],
      observerOptions: {
        root: null,
        rootMargin: optionsTarget.offsets,
        threshold: optionsTarget.mode === Medusa.MODE.BYPIXELS
          ? thresholdsByPixels() : optionsTarget.threshold,
      },
      emitGlobal: optionsTarget.emitGlobal,
      container: optionsTarget.container,
      mode: optionsTarget.mode,
      callback: optionsTarget.callback,
    };

    if (Array.isArray(optionsTarget.nodes)) {
      internalTarget.observedElements = optionsTarget.nodes;

      // TODO fallback observer
      this.createObserver(internalTarget);
    } else if (typeof optionsTarget.nodes === 'string') {
      internalTarget.observedElements = Array.from(
        optionsTarget.container.querySelectorAll(optionsTarget.nodes),
      );

      // TODO fallback observer
      this.createObserver(internalTarget);
    } else {
      console.warn(`the node list for the target id: ${optionsTarget.id} is invalid, no observer was added`);
    }

    return internalTarget;
  }

  private createObserver(internalTargetCreated : InternalTarget) {
    const callback = (entries : IntersectionObserverEntry[], observer : IntersectionObserver) => {
      entries.forEach((entry) => {
        if (internalTargetCreated.mode === Medusa.MODE.ONCE && entry.isIntersecting) {
          observer.unobserve(entry.target);

          const indexToRemove = internalTargetCreated.observedElements
            .findIndex(observedElement => observedElement === entry.target);
          internalTargetCreated.observedElements.splice(indexToRemove, 1);

          if (internalTargetCreated.observedElements.length === 0) {
            observer.disconnect();
            internalTargetCreated.observerInstance = null;
            const internalTargetCreatedIndex = this.internalTargets.findIndex((internalTarget) => internalTarget.id === internalTargetCreated.id);
            this.internalTargets.splice(internalTargetCreatedIndex, 1);
          }
        }

        const eventTarget = internalTargetCreated.emitGlobal ? window : internalTargetCreated.container;
        const customEvent = new CustomEvent('intesectionTriggered', <MedusaEventInit>{
          id: internalTargetCreated.id,
          detail: entry,
          isIn: entry.isIntersecting,
        });
        eventTarget.dispatchEvent(customEvent);

        if (entry.isIntersecting) internalTargetCreated.callback(entry, observer);
      });
    };

    internalTargetCreated.observerInstance = new IntersectionObserver(callback, internalTargetCreated.observerOptions);

    internalTargetCreated.observedElements.forEach((node : HTMLElement) => {
      if (internalTargetCreated.observerInstance === null) return;

      (<any>node).medusaId = crypto.randomBytes(6).toString('hex');

      internalTargetCreated.observerInstance.observe(node);
    });
  }
}

export default Medusa;
