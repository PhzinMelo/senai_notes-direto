import { Pipe, PipeTransform } from '@angular/core';

export interface INotaCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  ar?: number;
}

/**
 * CropStylePipe — converte {x, y, width, height} em % para propriedades CSS de background.
 *
 * Fórmula:
 *   background-size:     (100/width)%  (100/height)%
 *   background-position: (x/(100−width))×100%  (y/(100−height))×100%
 *
 * AUSÊNCIA DE DISTORÇÃO — por que funciona:
 *   O template aplica [style.aspect-ratio]="crop.ar" no container, onde:
 *     ar = cropPixelW / cropPixelH  (gravado em onCropperChange)
 *   Portanto:
 *     containerH = containerW / ar = containerW × rh / rw
 *     scaleX = containerW / rw
 *     scaleY = containerH / rh = (containerW × rh/rw) / rh = containerW / rw
 *     scaleX === scaleY  ∴  a imagem é escalada isotropicamente (sem distorção)
 *
 * O pipe em si não precisa saber o ar; apenas garante que o recorte preencha
 * o container 100% × 100%. Como container e crop têm o mesmo AR, isso é
 * matematicamente exato e livre de distorção.
 */
@Pipe({
  name: 'cropStyle',
  standalone: true,
  pure: true,
})
export class CropStylePipe implements PipeTransform {
  transform(
    crop: INotaCrop | null | undefined,
    imageUrl: string | null | undefined,
  ): Record<string, string> {
    if (!crop || !imageUrl?.trim()) return {};

    const { x, y, width, height } = crop;
    if (width <= 0 || height <= 0) return {};

    const scaleX = 100 / width;
    const scaleY = 100 / height;

    const remainX = 100 - width;
    const remainY = 100 - height;
    const posX = remainX > 0.001 ? (x / remainX) * 100 : 0;
    const posY = remainY > 0.001 ? (y / remainY) * 100 : 0;

    return {
      'background-image':    `url("${imageUrl}")`,
      'background-size':     `${scaleX * 100}% ${scaleY * 100}%`,
      'background-position': `${posX}% ${posY}%`,
      'background-repeat':   'no-repeat',
    };
  }
}