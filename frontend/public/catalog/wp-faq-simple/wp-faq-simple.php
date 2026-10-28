<?php
/*
Plugin Name: Plugin WordPress: preguntas frecuentes
Description: Shortcode para preguntas y respuestas desplegables con HTML nativo y contenido editable.
Version: 1.0.0
Author: CIEM
License: MIT
*/
if (!defined("ABSPATH")) { exit; }
add_shortcode('ciem_faq', function($atts) {
 $a = shortcode_atts(array('pregunta'=>'','respuesta'=>''), $atts, 'ciem_faq');
 if ($a['pregunta'] === '') return '';
 return '<details style="border:1px solid #d8e1ee;border-radius:8px;padding:16px;margin:12px 0"><summary style="cursor:pointer;font-weight:700">'.esc_html($a['pregunta']).'</summary><p>'.nl2br(esc_html($a['respuesta'])).'</p></details>';
});
