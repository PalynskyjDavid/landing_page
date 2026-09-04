package identifier

import (
	"crypto/rand"
	"fmt"
	"strings"
)

func NewUUID() (string, error) {
	var value [16]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", fmt.Errorf("generate UUID: %w", err)
	}

	value[6] = (value[6] & 0x0f) | 0x40
	value[8] = (value[8] & 0x3f) | 0x80

	return fmt.Sprintf(
		"%x-%x-%x-%x-%x",
		value[0:4],
		value[4:6],
		value[6:8],
		value[8:10],
		value[10:16],
	), nil
}

func NormalizeUUID(value string) (string, bool) {
	if len(value) != 36 {
		return "", false
	}

	for index, character := range value {
		if index == 8 || index == 13 || index == 18 || index == 23 {
			if character != '-' {
				return "", false
			}
			continue
		}

		if !isHexadecimal(character) {
			return "", false
		}
	}

	return strings.ToLower(value), true
}

func isHexadecimal(character rune) bool {
	return character >= '0' && character <= '9' ||
		character >= 'a' && character <= 'f' ||
		character >= 'A' && character <= 'F'
}
