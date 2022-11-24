import "./style.css";
import * as THREE from "three";
import debounce from "lodash.debounce";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass";

import AdditveShader from "./shaders/Additive";
import VolumetricLightScattering from "./shaders/VolumetricLightScattering";
import VolumetricLightCylinder from "./shaders/VolumetricLightCylinder";
