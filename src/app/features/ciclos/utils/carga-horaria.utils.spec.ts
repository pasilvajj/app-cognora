import { calcularHorasPorMateria } from './carga-horaria.utils';

describe('calcularHorasPorMateria', () => {
  it('distribui horas proporcionalmente ao peso', () => {
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: [
        { id: 1, checked: true, peso: 30 },
        { id: 2, checked: true, peso: 18 },
      ],
    });

    const t = result.perMateria.find(m => m.id === 1)!;
    const p = result.perMateria.find(m => m.id === 2)!;

    expect(t.horas).toBeGreaterThan(p.horas);
    expect(t.horas + p.horas).toBe(26);
  });

  it('não niveliza todas as matérias quando o pool é justo', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      materias: ids.map((id, i) => ({
        id,
        checked: true,
        peso: i === 0 ? 30 : 18,
      })),
    });

    const horas = result.perMateria.filter(m => m.horas > 0).map(m => m.horas);
    const unique = new Set(horas);
    expect(unique.size).toBeGreaterThan(1);
    expect(horas.reduce((a, b) => a + b, 0)).toBe(26);
  });
});
