/**
 * Registration input for the customer-facing signup form.
 * Field names mirror the backend column names (`user_*`) minus the prefix.
 */
export interface RegisterData {
  firstName: string;
  lastName:  string;
  email:     string;
  dob:       string;   
  phone:     string;   
  country:   string;   
  city:      string;   
  address:   string;
  password:  string;
  passwordConfirm?: string;
  acceptTerms?: boolean;
}

export interface LoginCreds {
  username: string;
  password: string;
}
