import { calcularHorasPorMateria } from './carga-horaria.utils';
import { MIN_HORAS_POR_MATERIA } from '../constants/estudo-livre.constants';

describe('calcularHorasPorMateria', () => {
  it('garante mínimo 1:30h e distribui o restante pelo peso', () => {
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 8,
      minHorasPorMateria: MIN_HORAS_POR_MATERIA,
      materias: [
        { id: 1, checked: true, peso: 30 },
        { id: 2, checked: true, peso: 18 },
      ],
    });

    const t = result.perMateria.find(m => m.id === 1)!;
    const p = result.perMateria.find(m => m.id === 2)!;

    expect(t.horas).toBeGreaterThanOrEqual(MIN_HORAS_POR_MATERIA);
    expect(p.horas).toBeGreaterThanOrEqual(MIN_HORAS_POR_MATERIA);
    expect(t.horas).toBeGreaterThan(p.horas);
    expect(t.horas + p.horas).toBe(8);
  });

  it('uma matéria ativa recebe o pool inteiro (26h com resto de 30 min)', () => {
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      minHorasPorMateria: MIN_HORAS_POR_MATERIA,
      materias: [{ id: 1, checked: true, peso: 5 }],
    });

    expect(result.perMateria[0].horas).toBe(26);
    expect(result.perMateria[0].horasLabel).toBe('26:00h');
  });

  it('com 11 matérias ativas nenhuma fica abaixo de 1:30h quando o pool permite', () => {
    const pesos = [5, 5, 5, 5, 7, 2, 30, 6, 8, 18, 6];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      minHorasPorMateria: MIN_HORAS_POR_MATERIA,
      materias: pesos.map((peso, i) => ({ id: i + 1, checked: true, peso })),
    });

    const horas = result.perMateria.filter(m => m.horas > 0).map(m => m.horas);
    expect(horas.every(h => h >= MIN_HORAS_POR_MATERIA)).toBe(true);
    expect(horas.reduce((a, b) => a + b, 0)).toBe(26);

    const transito = result.perMateria.find(m => m.id === 7)!;
    const portugues = result.perMateria.find(m => m.id === 10)!;
    const linguaEstrangeira = result.perMateria.find(m => m.id === 9)!;
    expect(transito.horas).toBeGreaterThan(portugues.horas);
    expect(portugues.horas).toBeGreaterThan(linguaEstrangeira.horas);
  });

  it('três matérias: resto de 30 min vai para a de maior peso (horas redondas)', () => {
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      minHorasPorMateria: MIN_HORAS_POR_MATERIA,
      materias: [
        { id: 1, checked: true, peso: 5 },
        { id: 2, checked: true, peso: 7 },
        { id: 3, checked: true, peso: 5 },
      ],
    });

    expect(result.perMateria.find(m => m.id === 1)!.horasLabel).toBe('7:30h');
    expect(result.perMateria.find(m => m.id === 2)!.horasLabel).toBe('11:00h');
    expect(result.perMateria.find(m => m.id === 3)!.horasLabel).toBe('7:30h');
  });

  it('com todas as matérias selecionadas, peso maior recebe mais sessões', () => {
    const pesos = [5, 5, 5, 5, 7, 2, 30, 6, 8, 18, 6, 5, 5, 5, 5];
    const result = calcularHorasPorMateria({
      cargaHorariaSemanal: 26,
      minHorasPorMateria: MIN_HORAS_POR_MATERIA,
      materias: pesos.map((peso, i) => ({ id: i + 1, checked: true, peso })),
    });

    const portugues = result.perMateria.find(m => m.id === 10)!;
    const linguaEstrangeira = result.perMateria.find(m => m.id === 9)!;
    const legislacaoEspecial = result.perMateria.find(m => m.id === 8)!;
    const transito = result.perMateria.find(m => m.id === 7)!;

    expect(portugues.horas).toBeGreaterThan(linguaEstrangeira.horas);
    expect(portugues.horas).toBeGreaterThan(legislacaoEspecial.horas);
    expect(transito.horas).toBeGreaterThanOrEqual(portugues.horas);
    expect(portugues.horas).toBe(3);
    expect(transito.horasLabel).toBe('3:30h');
  });
});
