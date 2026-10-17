import { z } from 'zod';

/** Mirrors GB-BE's CreateEmployeeDto/UpdateEmployeeDto. */
export const employeeSchema = z
  .object({
    firstName: z.string().min(1, 'Ingresa un nombre').max(100),
    lastName: z.string().min(1, 'Ingresa un apellido').max(100),
    documentType: z.enum(['CC', 'CE', 'TI', 'PPT', 'PASSPORT', 'NIT', 'OTHER']).optional(),
    documentNumber: z
      .string()
      .max(30)
      .refine((value) => value === '' || value.trim().length >= 3, 'El documento es muy corto')
      .optional(),
    phone: z.string().max(30).optional(),
    email: z.string().email('Ingresa un correo válido').max(150).optional().or(z.literal('')),
    roleId: z.string().min(1, 'Selecciona un cargo'),
    branchId: z.string().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'ON_VACATION', 'ON_LEAVE']),
    hireDate: z.string().optional(),
    notes: z.string().max(2000).optional(),
    payRate: z.coerce.number().min(0, 'El valor no puede ser negativo').optional(),
    payFrequency: z.enum(['SHIFT', 'WEEK', 'BIWEEKLY', 'MONTH']).optional(),
    /** Solo al crear: si se le crea de una vez su cuenta de acceso al sistema. */
    createAccess: z.boolean(),
  })
  .refine((values) => !values.documentNumber || values.documentType, {
    message: 'Elige el tipo de documento',
    path: ['documentType'],
  });

export type EmployeeFormValues = z.infer<typeof employeeSchema>;
