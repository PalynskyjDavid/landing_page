package results

const deviceComputer = "computer"
const deviceMobile = "mobile"

// An omitted device preserves compatibility with old clients and queued scores.
func defaultDeviceType(value string) string {
	if value == "" {
		return deviceComputer
	}
	return value
}

func validDeviceType(value string) bool {
	return value == deviceComputer || value == deviceMobile
}
