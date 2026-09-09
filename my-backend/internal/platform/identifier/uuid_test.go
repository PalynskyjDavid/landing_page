package identifier

import "testing"

func TestNewUUIDReturnsValidVersionFourUUID(t *testing.T) {
	value, err := NewUUID()
	if err != nil {
		t.Fatalf("expected UUID, got error %v", err)
	}

	normalized, valid := NormalizeUUID(value)
	if !valid {
		t.Fatalf("expected valid UUID, got %q", value)
	}
	if normalized != value {
		t.Fatalf("expected normalized UUID %q, got %q", value, normalized)
	}
	if value[14] != '4' {
		t.Fatalf("expected version 4 UUID, got %q", value)
	}
	if value[19] != '8' && value[19] != '9' && value[19] != 'a' && value[19] != 'b' {
		t.Fatalf("expected RFC 4122 variant, got %q", value)
	}
}

func TestNormalizeUUID(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		want      string
		wantValid bool
	}{
		{name: "lowercase", value: "550e8400-e29b-41d4-a716-446655440000", want: "550e8400-e29b-41d4-a716-446655440000", wantValid: true},
		{name: "uppercase", value: "550E8400-E29B-41D4-A716-446655440000", want: "550e8400-e29b-41d4-a716-446655440000", wantValid: true},
		{name: "missing", value: "", wantValid: false},
		{name: "wrong separators", value: "550e8400_e29b_41d4_a716_446655440000", wantValid: false},
		{name: "non hexadecimal", value: "550e8400-e29b-41d4-a716-44665544000z", wantValid: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, valid := NormalizeUUID(test.value)
			if valid != test.wantValid || got != test.want {
				t.Fatalf("NormalizeUUID(%q) = (%q, %t), want (%q, %t)", test.value, got, valid, test.want, test.wantValid)
			}
		})
	}
}
